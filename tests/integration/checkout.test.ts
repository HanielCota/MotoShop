import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { testDb, cleanupFixtures } from "../support/database";
vi.mock("@/lib/database", async () => ({ db: (await import("../support/database")).testDb }));
vi.mock("@/lib/inngest/client", () => ({ inngest: { send: vi.fn(async () => ({ ids: [] })) } }));
vi.mock("@/modules/auth/application/authorization", () => ({ getCurrentSession: vi.fn(async () => null) }));
import { executeCheckout } from "@/modules/checkout/application/checkout-service";
import { updateSellerCommission } from "@/modules/admin/application/update-seller-commission";
import { quoteShippingForCart } from "@/modules/checkout/application/shipping-quotes";
import { advanceOwnShipment, setOwnShippingMethodActive } from "@/modules/shipping/application/own-shipping";
import { reconcileMercadoPagoPayment } from "@/modules/payments/application/reconcile-payment";
import { recoverPayment } from "@/modules/payments/application/recover-payment";
import { listApprovedProducts } from "@/modules/products/queries/products";
import type { CheckoutInput } from "@/modules/checkout/schemas/checkout";
import type { CreatePaymentResult, PaymentProvider } from "@/shared/payment/payment-provider";

const run = randomUUID().slice(0, 8);
const email = `integration-${run}@example.test`;
const fixtures = {
  sellerIds: [] as string[],
  userIds: [] as string[],
  emails: [email],
  cartIds: [] as string[],
  couponIds: [] as string[],
};
const variants: string[] = [];
const methods: string[] = [];
let couponCode = "";
function provider(status: CreatePaymentResult["status"] = "APPROVED"): PaymentProvider {
  return {
    supportsSellerCount: () => true,
    createPayment: vi.fn(async () => ({
      externalId: `test-${randomUUID()}`,
      status,
      providerMetadata: { simulated: true },
    })),
    getPayment: vi.fn(),
    refund: vi.fn(),
  };
}
async function cartInput(quantity = 1, withCoupon = false) {
  const identity = { guestAccessTokenHash: randomUUID() };
  const cart = await testDb.cart.create({
    data: { ...identity, items: { create: variants.map((variantId) => ({ variantId, quantity })) } },
  });
  fixtures.cartIds.push(cart.id);
  const data: CheckoutInput = {
    customerName: "Teste integração",
    customerEmail: email,
    customerPhone: "11999999999",
    customerTaxId: "19119119100",
    postalCode: "01001000",
    street: "Rua Teste",
    number: "1",
    neighborhood: "Centro",
    city: "São Paulo",
    state: "SP",
    paymentMethodId: "pix",
    checkoutIdempotencyKey: randomUUID(),
    shippingSelections: JSON.stringify(
      Object.fromEntries(fixtures.sellerIds.map((id, i) => [id, `own:${methods[i]}`])),
    ),
    ...(withCoupon ? { couponCode } : {}),
  };
  return { data, identity, session: null };
}
beforeAll(async () => {
  const category = await testDb.category.findFirstOrThrow({ where: { active: true } });
  const brand = await testDb.brand.findFirstOrThrow({ where: { active: true } });
  const actor = await testDb.user.create({ data: { name: "Integration", email, emailVerified: false } });
  fixtures.userIds.push(actor.id);
  for (let i = 0; i < 2; i++) {
    const seller = await testDb.seller.create({
      data: {
        type: "INDIVIDUAL",
        status: "ACTIVE",
        commissionBpsOverride: 1000,
        store: { create: { name: `Integration ${run} ${i}`, slug: `integration-${run}-${i}` } },
      },
      include: { store: true },
    });
    fixtures.sellerIds.push(seller.id);
    const product = await testDb.product.create({
      data: {
        name: `Integration ${run} ${i}`,
        slug: `integration-${run}-${i}`,
        description: "Temporary test fixture",
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedByUserId: actor.id,
        sellerId: seller.id,
        storeId: seller.store!.id,
        categoryId: category.id,
        brandId: brand.id,
        variants: {
          create: {
            title: "Única",
            sku: `test-${run}-${i}`,
            priceInCents: (i + 1) * 10000,
            inventory: { create: { availableQuantity: 20 } },
          },
        },
      },
      include: { variants: true },
    });
    variants.push(product.variants[0]!.id);
    const method = await testDb.sellerShippingMethod.create({
      data: {
        sellerId: seller.id,
        name: "Entrega teste",
        postalCodeStart: "01000000",
        postalCodeEnd: "01999999",
        priceInCents: (i + 1) * 1000,
        estimatedDeliveryDays: 2,
        active: true,
      },
    });
    methods.push(method.id);
  }
  couponCode = `TEST${run.toUpperCase()}`;
  const coupon = await testDb.coupon.create({
    data: {
      code: couponCode,
      ownerType: "MARKETPLACE",
      fundedBy: "MARKETPLACE",
      discountType: "FIXED_AMOUNT",
      fixedAmountInCents: 3000,
      minimumPurchaseInCents: 0,
      active: true,
    },
  });
  fixtures.couponIds.push(coupon.id);
});
afterAll(async () => {
  await cleanupFixtures(fixtures);
  await testDb.$disconnect();
});

describe("checkout with real development database and simulated payments", () => {
  it("uses active promotions and packaging, preserving order snapshots after commission changes", async () => {
    const variant = await testDb.productVariant.findUniqueOrThrow({ where: { id: variants[0]! } });
    const sellerId = fixtures.sellerIds[0]!;
    try {
      await testDb.product.update({
        where: { id: variant.productId },
        data: { weightInGrams: 1000, heightInMillimeters: 200, widthInMillimeters: 250, lengthInMillimeters: 300 },
      });
      await testDb.productVariant.update({
        where: { id: variant.id },
        data: {
          weightInGrams: 1500,
          promotionalPriceInCents: 8000,
          promotionStartsAt: new Date(Date.now() - 60_000),
          promotionEndsAt: new Date(Date.now() + 60_000),
        },
      });
      await updateSellerCommission(fixtures.userIds[0]!, {
        sellerId,
        previousCommissionBpsOverride: 1000,
        commissionBpsOverride: 1050,
      });
      expect((await listApprovedProducts({ query: run, promotion: "ON_SALE" })).total).toBe(1);
      const result = await executeCheckout(await cartInput(), provider());
      const sellerOrder = await testDb.sellerOrder.findFirstOrThrow({
        where: { sellerId, order: { orderNumber: result.orderNumber } },
        include: { items: true },
      });
      expect(sellerOrder).toMatchObject({
        itemsSubtotalInCents: 8000,
        commissionBps: 1050,
        marketplaceCommissionInCents: 840,
      });
      expect(sellerOrder.items[0]).toMatchObject({
        weightInGramsSnapshot: 1500,
        heightInMillimetersSnapshot: 200,
        widthInMillimetersSnapshot: 250,
        lengthInMillimetersSnapshot: 300,
      });
      await updateSellerCommission(fixtures.userIds[0]!, {
        sellerId,
        previousCommissionBpsOverride: 1050,
        commissionBpsOverride: null,
      });
      expect(await testDb.sellerOrder.findUniqueOrThrow({ where: { id: sellerOrder.id } })).toMatchObject({
        commissionBps: 1050,
        marketplaceCommissionInCents: 840,
      });
      await expect(
        updateSellerCommission(fixtures.userIds[0]!, {
          sellerId,
          previousCommissionBpsOverride: 1050,
          commissionBpsOverride: 2000,
        }),
      ).rejects.toThrow(/mudou/);
      expect(await testDb.auditLog.count({ where: { action: "SELLER_COMMISSION_UPDATED", entityId: sellerId } })).toBe(
        2,
      );
    } finally {
      await testDb.seller.update({ where: { id: sellerId }, data: { commissionBpsOverride: 1000 } });
      await testDb.productVariant.update({
        where: { id: variant.id },
        data: { weightInGrams: null, promotionalPriceInCents: null, promotionStartsAt: null, promotionEndsAt: null },
      });
      await testDb.product.update({
        where: { id: variant.productId },
        data: { weightInGrams: null, heightInMillimeters: null, widthInMillimeters: null, lengthInMillimeters: null },
      });
    }
  });
  it("passes tokenized card data to the provider once and does not persist the token", async () => {
    const input = await cartInput();
    input.data.paymentMethodId = "visa";
    input.data.paymentToken = "a".repeat(32);
    input.data.issuerId = "25";
    const fake = provider("APPROVED");
    const result = await executeCheckout(input, fake);
    expect(await executeCheckout(input, fake)).toEqual(result);
    expect(fake.createPayment).toHaveBeenCalledTimes(1);
    expect(fake.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentMethodId: "visa",
        paymentToken: "a".repeat(32),
        issuerId: "25",
        installments: 1,
      }),
    );
    const order = await testDb.order.findUniqueOrThrow({
      where: { orderNumber: result.orderNumber },
      include: { payments: { include: { transactions: true } } },
    });
    expect(order.status).toBe("PAID");
    expect(JSON.stringify(order)).not.toContain("a".repeat(32));
  });
  it("recovers a lost charge response and releases cancelled stock exactly once", async () => {
    const input = await cartInput();
    const fake = provider();
    vi.mocked(fake.createPayment).mockRejectedValue(new Error("simulated lost response"));
    const before = await testDb.inventory.findMany({
      where: { variantId: { in: variants } },
      orderBy: { variantId: "asc" },
    });
    const checkout = await executeCheckout(input, fake);
    const payment = await testDb.payment.findFirstOrThrow({ where: { order: { orderNumber: checkout.orderNumber } } });
    expect(payment.externalId).toBeNull();
    const response = {
      externalId: `recovered-${randomUUID()}`,
      status: "CANCELLED" as const,
      providerMetadata: {
        external_reference: checkout.orderNumber,
        transaction_amount: payment.amountInCents / 100,
        currency_id: "BRL",
        payment_method_id: "pix",
      },
    };
    const recoveryProvider = {
      findPaymentByOrderNumber: vi.fn(async () => response),
      getPayment: vi.fn(async () => response),
    };
    await Promise.all([recoverPayment(payment.id, recoveryProvider), recoverPayment(payment.id, recoveryProvider)]);
    await recoverPayment(payment.id, recoveryProvider);
    expect(await testDb.order.findUniqueOrThrow({ where: { orderNumber: checkout.orderNumber } })).toMatchObject({
      status: "CANCELLED",
    });
    const after = await testDb.inventory.findMany({
      where: { variantId: { in: variants } },
      orderBy: { variantId: "asc" },
    });
    expect(after.map(({ availableQuantity, reservedQuantity }) => ({ availableQuantity, reservedQuantity }))).toEqual(
      before.map(({ availableQuantity, reservedQuantity }) => ({ availableQuantity, reservedQuantity })),
    );
    expect(fake.createPayment).toHaveBeenCalledTimes(1);
  });
  it("filters and paginates the public catalog in PostgreSQL with deterministic prices", async () => {
    const page = await listApprovedProducts({ query: run, pageSize: 1, page: 2, sort: "price_asc" });
    expect(page.total).toBe(2);
    expect(page.pageCount).toBe(2);
    expect(page.products[0]?.variants[0]?.priceInCents).toBe(20000);
    const limited = await listApprovedProducts({ query: run, minPriceInCents: 9000, maxPriceInCents: 11000 });
    expect(limited.total).toBe(1);
    expect((await listApprovedProducts({ query: run, promotion: "ON_SALE" })).total).toBe(0);
    expect((await listApprovedProducts({ query: run, availability: "OUT_OF_STOCK" })).total).toBe(0);
    expect((await listApprovedProducts({ query: run, page: 999, pageSize: 1 })).page).toBe(2);
  });
  it("hides suspended stores and rejects their cart items before payment", async () => {
    const input = await cartInput();
    await testDb.seller.update({ where: { id: fixtures.sellerIds[0]! }, data: { status: "SUSPENDED" } });
    try {
      expect((await listApprovedProducts({ query: run })).total).toBe(1);
      const fake = provider();
      await expect(executeCheckout(input, fake)).rejects.toThrow(/disponibilidade/);
      expect(fake.createPayment).not.toHaveBeenCalled();
    } finally {
      await testDb.seller.update({ where: { id: fixtures.sellerIds[0]! }, data: { status: "ACTIVE" } });
    }
  });
  it("creates two SellerOrders, exact money, coupon allocations and auditable stock once", async () => {
    const input = await cartInput(1, true);
    const fake = provider();
    const result = await executeCheckout(input, fake);
    const order = await testDb.order.findUniqueOrThrow({
      where: { orderNumber: result.orderNumber },
      include: { sellerOrders: { include: { shipment: true } }, couponRedemptions: true },
    });
    expect(order).toMatchObject({
      status: "PAID",
      itemsSubtotalInCents: 30000,
      discountAmountInCents: 3000,
      shippingAmountInCents: 3000,
      totalAmountInCents: 30000,
    });
    expect(order.sellerOrders).toHaveLength(2);
    expect(order.sellerOrders.reduce((sum, item) => sum + item.marketplaceDiscountInCents, 0)).toBe(3000);
    expect(order.sellerOrders.reduce((sum, item) => sum + item.marketplaceSubsidyInCents, 0)).toBe(0);
    expect(order.sellerOrders.reduce((sum, item) => sum + item.marketplaceCommissionInCents, 0)).toBe(3000);
    expect(order.couponRedemptions).toHaveLength(1);
    expect(await executeCheckout(input, fake)).toEqual(result);
    expect(fake.createPayment).toHaveBeenCalledTimes(1);
    expect(result.guestAccessToken).toBeTruthy();
    await expect(
      executeCheckout({ ...input, identity: { guestAccessTokenHash: "another-visitor" } }, fake),
    ).rejects.toThrow(/sessão/);
    expect(await testDb.inventoryMovement.count({ where: { referenceId: order.id, type: "RESERVATION" } })).toBe(2);
    const first = order.sellerOrders[0]!;
    await expect(
      advanceOwnShipment({
        sellerId: "another-seller",
        actorUserId: fixtures.userIds[0]!,
        sellerOrderId: first.id,
        status: "SHIPPED",
      }),
    ).rejects.toThrow(/não encontrado/);
    await expect(
      advanceOwnShipment({
        sellerId: first.sellerId,
        actorUserId: fixtures.userIds[0]!,
        sellerOrderId: first.id,
        status: "DELIVERED",
      }),
    ).rejects.toThrow(/estado/);
    await advanceOwnShipment({
      sellerId: first.sellerId,
      actorUserId: fixtures.userIds[0]!,
      sellerOrderId: first.id,
      status: "SHIPPED",
    });
    expect((await testDb.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PARTIALLY_SHIPPED");
    await advanceOwnShipment({
      sellerId: first.sellerId,
      actorUserId: fixtures.userIds[0]!,
      sellerOrderId: first.id,
      status: "DELIVERED",
    });
    const payment = await testDb.payment.findFirstOrThrow({ where: { orderId: order.id } });
    await reconcileMercadoPagoPayment({
      externalId: payment.externalId!,
      result: { externalId: payment.externalId!, status: "APPROVED", providerMetadata: {} },
    });
    expect((await testDb.sellerOrder.findUniqueOrThrow({ where: { id: first.id } })).status).toBe("DELIVERED");
  });
  it("rolls back the whole order on insufficient stock", async () => {
    const input = await cartInput(999);
    const fake = provider();
    const before = await testDb.order.count({ where: { customerEmail: email } });
    await expect(executeCheckout(input, fake)).rejects.toThrow(/estoque/);
    expect(await testDb.order.count({ where: { customerEmail: email } })).toBe(before);
    expect(fake.createPayment).not.toHaveBeenCalled();
  });
  it("releases reservations and coupon usage on definitive decline", async () => {
    const input = await cartInput(1, true);
    const before = await testDb.inventory.findMany({
      where: { variantId: { in: variants } },
      orderBy: { variantId: "asc" },
    });
    const result = await executeCheckout(input, provider("FAILED"));
    const order = await testDb.order.findUniqueOrThrow({ where: { orderNumber: result.orderNumber } });
    expect(order.status).toBe("CANCELLED");
    expect(await testDb.couponRedemption.count({ where: { orderId: order.id } })).toBe(0);
    const after = await testDb.inventory.findMany({
      where: { variantId: { in: variants } },
      orderBy: { variantId: "asc" },
    });
    expect(after.map((i) => [i.availableQuantity, i.reservedQuantity])).toEqual(
      before.map((i) => [i.availableQuantity, i.reservedQuantity]),
    );
  });
  it("preserves pending reservations after an uncertain provider timeout", async () => {
    const input = await cartInput();
    const fake = provider();
    vi.mocked(fake.createPayment).mockRejectedValue(new Error("simulated timeout"));
    const result = await executeCheckout(input, fake);
    expect((await testDb.order.findUniqueOrThrow({ where: { orderNumber: result.orderNumber } })).status).toBe(
      "PENDING_PAYMENT",
    );
    expect(await executeCheckout(input, fake)).toEqual(result);
    expect(fake.createPayment).toHaveBeenCalledTimes(1);
  });
  it("confirms a pending Pix once despite duplicate and late payment updates", async () => {
    const result = await executeCheckout(await cartInput(), provider("PENDING"));
    const order = await testDb.order.findUniqueOrThrow({
      where: { orderNumber: result.orderNumber },
      include: { payments: true },
    });
    const externalId = order.payments[0]?.externalId;
    expect(externalId).toBeTruthy();
    expect(order.status).toBe("PENDING_PAYMENT");

    const approved = { externalId: externalId!, status: "APPROVED" as const, providerMetadata: {} };
    await reconcileMercadoPagoPayment({ externalId: externalId!, result: approved });
    await reconcileMercadoPagoPayment({ externalId: externalId!, result: approved });
    await reconcileMercadoPagoPayment({
      externalId: externalId!,
      result: { externalId: externalId!, status: "FAILED", providerMetadata: {} },
    });

    expect((await testDb.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
    expect((await testDb.payment.findFirstOrThrow({ where: { orderId: order.id } })).status).toBe("APPROVED");
    expect(await testDb.inventoryMovement.count({ where: { referenceId: order.id, type: "SALE" } })).toBe(2);
  });
  it("does not treat authorization without capture as a paid order", async () => {
    const result = await executeCheckout(await cartInput(), provider("AUTHORIZED"));
    expect((await testDb.order.findUniqueOrThrow({ where: { orderNumber: result.orderNumber } })).status).toBe(
      "PENDING_PAYMENT",
    );
  });
  it("rejects forged shipping and cross-tenant shipping changes", async () => {
    const input = await cartInput();
    input.data.shippingSelections = JSON.stringify({ [fixtures.sellerIds[0]!]: `own:${methods[1]}` });
    await expect(executeCheckout(input, provider())).rejects.toThrow(/frete/);
    await expect(
      setOwnShippingMethodActive(fixtures.sellerIds[1]!, fixtures.userIds[0]!, methods[0]!, false),
    ).rejects.toThrow(/não encontrada/);
    await expect(quoteShippingForCart(null, "01001000")).rejects.toThrow(/produto/);
  });
  it("rejects expired and exhausted coupons without creating a charge", async () => {
    const fake = provider();
    const input = await cartInput(1, true);
    const id = fixtures.couponIds[0]!;
    try {
      await testDb.coupon.update({ where: { id }, data: { endsAt: new Date(0) } });
      await expect(executeCheckout(input, fake)).rejects.toThrow(/expirado/);
      await testDb.coupon.update({ where: { id }, data: { endsAt: null, globalUsageLimit: 1 } });
      await expect(executeCheckout(input, fake)).rejects.toThrow(/limite/);
      expect(fake.createPayment).not.toHaveBeenCalled();
    } finally {
      await testDb.coupon.update({ where: { id }, data: { endsAt: null, globalUsageLimit: null } });
    }
  });
  it("allocates a seller coupon only to its owner and snapshots its funding", async () => {
    const coupon = await testDb.coupon.create({
      data: {
        code: `SELLER${run.toUpperCase()}`,
        ownerType: "SELLER",
        sellerId: fixtures.sellerIds[0]!,
        fundedBy: "SELLER",
        discountType: "FIXED_AMOUNT",
        fixedAmountInCents: 1000,
        minimumPurchaseInCents: 0,
        active: true,
      },
    });
    fixtures.couponIds.push(coupon.id);
    const input = await cartInput();
    input.data.couponCode = coupon.code;
    const result = await executeCheckout(input, provider());
    const orders = await testDb.sellerOrder.findMany({ where: { order: { orderNumber: result.orderNumber } } });
    expect(orders.find((o) => o.sellerId === fixtures.sellerIds[0])).toMatchObject({
      discountAmountInCents: 1000,
      sellerDiscountInCents: 1000,
      sellerNetAmountInCents: 8000,
    });
    expect(orders.find((o) => o.sellerId === fixtures.sellerIds[1])).toMatchObject({
      discountAmountInCents: 0,
      sellerDiscountInCents: 0,
    });
  });
  it("concurrent attempts cannot convert one cart twice", async () => {
    const input = await cartInput();
    const fake = provider();
    const results = await Promise.allSettled([
      executeCheckout(input, fake),
      executeCheckout({ ...input, data: { ...input.data, checkoutIdempotencyKey: randomUUID() } }, fake),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(fake.createPayment).toHaveBeenCalledTimes(1);
  });
});
