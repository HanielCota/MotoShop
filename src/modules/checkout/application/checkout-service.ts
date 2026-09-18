import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { mercadoPagoProvider } from "@/lib/payment/mercado-pago-provider";
import type { getCurrentSession } from "@/modules/auth/application/authorization";
import { cartOwnerWhere, hashGuestToken, type CartIdentity } from "@/modules/cart/infrastructure/cart-access";
import { allocateDiscountAcrossSubtotals, calculateCouponDiscount } from "@/modules/coupons/domain/coupon-discount";
import {
  commitOrderReservations,
  releaseOrderReservations,
} from "@/modules/inventory/application/settle-order-inventory";
import { calculateCommissionInCents, multiplyMoneyInCents, sumMoneyInCents } from "@/modules/orders/domain/money";
import { calculateOrderTotals } from "@/modules/orders/domain/order-totals";
import { getCurrentPriceInCents } from "@/modules/products/domain/pricing";
import { ApplicationError } from "@/shared/errors/application-error";

import { shippingSelectionsSchema, type CheckoutInput } from "../schemas/checkout";
import { quoteShippingForActiveCart } from "./shipping-quotes";

type CheckoutSession = Awaited<ReturnType<typeof getCurrentSession>>;
export type CheckoutResult = { orderNumber: string; guestAccessToken?: string };

export async function executeCheckout(input: {
  data: CheckoutInput;
  identity: CartIdentity;
  session: CheckoutSession;
}): Promise<CheckoutResult> {
  const existingOrder = await findExistingOrder(input.data.checkoutIdempotencyKey);
  if (existingOrder) return { orderNumber: existingOrder };

  const selections = parseShippingSelections(input.data.shippingSelections);
  const cart = await findActiveCart(input.identity);
  const coupon = await findActiveCoupon(input.data.couponCode, input.data.customerEmail, input.session?.user.id);
  const quoteGroups = await quoteShippingForActiveCart(input.data.postalCode);
  const sellerCharges = await calculateSellerCharges(cart.items, quoteGroups, selections, coupon);
  assertPaymentCanHandleSellers(sellerCharges.length);

  const orderNumber = createOrderNumber();
  const guestAccessToken = input.session ? undefined : randomUUID();
  const order = await reserveCartAndCreateOrder({
    input,
    cart,
    sellerCharges,
    coupon,
    orderNumber,
    ...(guestAccessToken ? { guestAccessToken } : {}),
  });

  try {
    const paymentResult = await mercadoPagoProvider.createPayment({
      orderNumber,
      amountInCents: order.totalAmountInCents,
      payerEmail: input.data.customerEmail,
      paymentMethodId: input.data.paymentMethodId,
      applicationFeeInCents: sumMoneyInCents(sellerCharges.map((charge) => charge.commissionInCents)),
      idempotencyKey: input.data.checkoutIdempotencyKey,
      sellerCount: sellerCharges.length,
    });
    await finalizePayment({ order, paymentResult });
  } catch (error) {
    await releaseFailedCheckout(order.orderId, order.paymentId, cart.id);
    throw error;
  }

  return { orderNumber, ...(guestAccessToken ? { guestAccessToken } : {}) };
}

async function findExistingOrder(idempotencyKey: string): Promise<string | undefined> {
  const transaction = await db.paymentTransaction.findUnique({
    where: { idempotencyKey },
    include: { payment: { include: { order: true } } },
  });
  return transaction?.payment.order.orderNumber;
}

function parseShippingSelections(value: string): Record<string, string> {
  try {
    return shippingSelectionsSchema.parse(JSON.parse(value));
  } catch {
    throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Escolha uma opção de frete para cada loja." });
  }
}

async function findActiveCart(identity: CartIdentity) {
  const cart = await db.cart.findFirst({
    where: { ...cartOwnerWhere(identity), status: "ACTIVE" },
    include: {
      items: {
        include: {
          variant: {
            include: {
              inventory: true,
              product: { include: { seller: { include: { store: true } }, store: true } },
            },
          },
        },
      },
    },
  });
  if (!cart || cart.items.length === 0)
    throw new ApplicationError({ code: "NOT_FOUND", message: "Seu carrinho está vazio." });
  return cart;
}

async function calculateSellerCharges(
  items: Awaited<ReturnType<typeof findActiveCart>>["items"],
  quoteGroups: Awaited<ReturnType<typeof quoteShippingForActiveCart>>,
  selections: Record<string, string>,
  coupon?: Awaited<ReturnType<typeof findActiveCoupon>>,
) {
  const marketplaceConfig = await db.marketplaceConfiguration.findUnique({ where: { key: "default" } });
  if (!marketplaceConfig) {
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message: "A comissão padrão do marketplace ainda não foi configurada.",
    });
  }

  const rawCharges = Array.from(Map.groupBy(items, (item) => item.variant.product.sellerId).entries()).map(
    ([sellerId, sellerItems]) => {
      const quoteGroup = quoteGroups.find((group) => group.sellerId === sellerId);
      const firstItem = sellerItems[0];
      const shipping = quoteGroup?.quotes.find((quote) => quote.serviceCode === selections[sellerId]);
      if (!quoteGroup || !shipping || !firstItem) {
        throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Escolha uma opção de frete para cada loja." });
      }

      const totals = calculateOrderTotals({
        lines: sellerItems.map((item) => ({
          unitPriceInCents: getCurrentPriceInCents(item.variant),
          quantity: item.quantity,
        })),
        shippingAmountInCents: shipping.priceInCents,
      });
      return {
        sellerId,
        items: sellerItems,
        storeId: firstItem.variant.product.storeId,
        storeName: firstItem.variant.product.store.name,
        shipping,
        totals,
      };
    },
  );

  const rawSubtotals = rawCharges.map((charge) => charge.totals.itemsSubtotalInCents);
  const totalSubtotal = sumMoneyInCents(rawSubtotals);
  const couponDiscount = coupon
    ? calculateCouponDiscount(
        coupon,
        coupon.ownerType === "SELLER"
          ? (rawCharges.find((charge) => charge.sellerId === coupon.sellerId)?.totals.itemsSubtotalInCents ?? 0)
          : totalSubtotal,
      )
    : 0;
  const allocations = coupon
    ? coupon.ownerType === "MARKETPLACE"
      ? allocateDiscountAcrossSubtotals(rawSubtotals, couponDiscount)
      : rawCharges.map((charge) => (charge.sellerId === coupon.sellerId ? couponDiscount : 0))
    : rawCharges.map(() => 0);

  return rawCharges.map((charge, index) => {
    const discountInCents = allocations[index] ?? 0;
    const totals = calculateOrderTotals({
      lines: charge.items.map((item) => ({
        unitPriceInCents: getCurrentPriceInCents(item.variant),
        quantity: item.quantity,
      })),
      orderDiscountAmountInCents: discountInCents,
      shippingAmountInCents: charge.shipping.priceInCents,
    });
    const commissionBps =
      charge.items[0]?.variant.product.seller.commissionBpsOverride ?? marketplaceConfig.defaultCommissionBps;
    const commissionInCents = calculateCommissionInCents(totals.itemsSubtotalInCents, commissionBps);
    const sellerFundedDiscount = coupon?.fundedBy === "SELLER" ? discountInCents : 0;
    return {
      ...charge,
      totals,
      commissionBps,
      commissionInCents,
      marketplaceSubsidyInCents: coupon?.fundedBy === "MARKETPLACE" ? discountInCents : 0,
      sellerSubsidyInCents: sellerFundedDiscount,
      sellerNetAmountInCents: totals.itemsSubtotalInCents - sellerFundedDiscount - commissionInCents,
    };
  });
}

async function findActiveCoupon(code: string | undefined, customerEmail: string, userId?: string) {
  if (!code) return undefined;
  const coupon = await db.coupon.findUnique({ where: { code } });
  if (
    !coupon ||
    !coupon.active ||
    (coupon.startsAt && coupon.startsAt > new Date()) ||
    (coupon.endsAt && coupon.endsAt < new Date())
  ) {
    throw new ApplicationError({ code: "CONFLICT", message: "Cupom inválido ou expirado.", statusCode: 409 });
  }
  const usageWhere = {
    couponId: coupon.id,
    OR: [{ customerEmailSnapshot: customerEmail }, ...(userId ? [{ userId }] : [])],
  };
  const [globalUsage, customerUsage] = await Promise.all([
    coupon.globalUsageLimit === null
      ? Promise.resolve(0)
      : db.couponRedemption.count({ where: { couponId: coupon.id } }),
    coupon.perCustomerUsageLimit === null ? Promise.resolve(0) : db.couponRedemption.count({ where: usageWhere }),
  ]);
  if (coupon.globalUsageLimit !== null && globalUsage >= coupon.globalUsageLimit) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "O limite de uso deste cupom foi atingido.",
      statusCode: 409,
    });
  }
  if (coupon.perCustomerUsageLimit !== null && customerUsage >= coupon.perCustomerUsageLimit) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Você já atingiu o limite de uso deste cupom.",
      statusCode: 409,
    });
  }
  return coupon;
}

function assertPaymentCanHandleSellers(sellerCount: number): void {
  if (!mercadoPagoProvider.supportsSellerCount(sellerCount)) {
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message: "O pagamento com múltiplos sellers depende da habilitação do split 1:N no Mercado Pago.",
      statusCode: 503,
    });
  }
}

async function reserveCartAndCreateOrder(input: {
  input: { data: CheckoutInput; session: CheckoutSession };
  cart: Awaited<ReturnType<typeof findActiveCart>>;
  sellerCharges: Awaited<ReturnType<typeof calculateSellerCharges>>;
  coupon?: Awaited<ReturnType<typeof findActiveCoupon>>;
  orderNumber: string;
  guestAccessToken?: string;
}) {
  const totalAmountInCents = sumMoneyInCents(input.sellerCharges.map((charge) => charge.totals.totalAmountInCents));
  const totalDiscountInCents = sumMoneyInCents(
    input.sellerCharges.map((charge) => charge.totals.discountAmountInCents),
  );
  const totalShippingInCents = sumMoneyInCents(
    input.sellerCharges.map((charge) => charge.totals.shippingAmountInCents),
  );
  return db.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNumber: input.orderNumber,
        customerName: input.input.data.customerName,
        customerEmail: input.input.data.customerEmail,
        customerPhone: input.input.data.customerPhone,
        ...(input.input.data.customerTaxId ? { customerTaxId: input.input.data.customerTaxId } : {}),
        ...(input.input.session ? { userId: input.input.session.user.id } : {}),
        ...(input.guestAccessToken ? { guestAccessTokenHash: hashGuestToken(input.guestAccessToken) } : {}),
        itemsSubtotalInCents: sumMoneyInCents(input.sellerCharges.map((charge) => charge.totals.itemsSubtotalInCents)),
        discountAmountInCents: totalDiscountInCents,
        shippingAmountInCents: totalShippingInCents,
        customerShippingAmountInCents: totalShippingInCents,
        totalAmountInCents,
        shippingAddress: { create: createShippingAddress(input.input.data) },
      },
    });

    for (const charge of input.sellerCharges) {
      const sellerOrder = await tx.sellerOrder.create({
        data: {
          orderId: order.id,
          sellerId: charge.sellerId,
          storeId: charge.storeId,
          storeNameSnapshot: charge.storeName,
          itemsSubtotalInCents: charge.totals.itemsSubtotalInCents,
          discountAmountInCents: charge.totals.discountAmountInCents,
          shippingAmountInCents: charge.totals.shippingAmountInCents,
          customerShippingAmountInCents: charge.totals.customerShippingAmountInCents,
          marketplaceSubsidyInCents: charge.marketplaceSubsidyInCents,
          sellerSubsidyInCents: charge.sellerSubsidyInCents,
          commissionBps: charge.commissionBps,
          marketplaceCommissionInCents: charge.commissionInCents,
          sellerNetAmountInCents: charge.sellerNetAmountInCents,
          shipment: {
            create: {
              provider: charge.shipping.provider,
              serviceCode: charge.shipping.serviceCode,
              carrier: charge.shipping.carrier,
              service: charge.shipping.service,
              priceInCents: charge.shipping.priceInCents,
              ...(charge.shipping.estimatedDeliveryDays !== undefined
                ? { estimatedDeliveryDays: charge.shipping.estimatedDeliveryDays }
                : {}),
            },
          },
          items: { create: charge.items.map((item) => createOrderItem(item, charge.sellerId)) },
        },
      });
      if (!sellerOrder.id)
        throw new ApplicationError({ code: "INTERNAL_ERROR", message: "Não foi possível criar o pedido do seller." });
      await reserveInventory(tx, charge);
    }

    const payment = await tx.payment.create({
      data: {
        provider: "MERCADO_PAGO",
        method: input.input.data.paymentMethodId,
        amountInCents: totalAmountInCents,
        orderId: order.id,
        transactions: {
          create: {
            type: "AUTHORIZATION",
            amountInCents: totalAmountInCents,
            idempotencyKey: input.input.data.checkoutIdempotencyKey,
          },
        },
      },
      include: { transactions: true },
    });
    await tx.cart.update({ where: { id: input.cart.id }, data: { status: "CONVERTED" } });
    if (input.coupon) {
      await tx.$queryRaw`SELECT id FROM "coupons" WHERE id = ${input.coupon.id} FOR UPDATE`;
      const coupon = await tx.coupon.findUniqueOrThrow({ where: { id: input.coupon.id } });
      const usageWhere = {
        couponId: coupon.id,
        OR: [
          { customerEmailSnapshot: input.input.data.customerEmail },
          ...(input.input.session ? [{ userId: input.input.session.user.id }] : []),
        ],
      };
      const [globalUsage, customerUsage] = await Promise.all([
        tx.couponRedemption.count({ where: { couponId: coupon.id } }),
        tx.couponRedemption.count({ where: usageWhere }),
      ]);
      if (
        !coupon.active ||
        (coupon.globalUsageLimit !== null && globalUsage >= coupon.globalUsageLimit) ||
        (coupon.perCustomerUsageLimit !== null && customerUsage >= coupon.perCustomerUsageLimit)
      ) {
        throw new ApplicationError({ code: "CONFLICT", message: "O cupom não está mais disponível.", statusCode: 409 });
      }
      await tx.couponRedemption.create({
        data: {
          customerEmailSnapshot: input.input.data.customerEmail,
          discountAmountInCents: totalDiscountInCents,
          couponId: coupon.id,
          orderId: order.id,
          ...(input.input.session ? { userId: input.input.session.user.id } : {}),
        },
      });
    }
    const transaction = payment.transactions[0];
    if (!transaction)
      throw new ApplicationError({ code: "INTERNAL_ERROR", message: "Transação de pagamento não encontrada." });
    return { orderId: order.id, paymentId: payment.id, paymentTransactionId: transaction.id, totalAmountInCents };
  });
}

function createShippingAddress(data: CheckoutInput) {
  return {
    recipient: data.customerName,
    postalCode: data.postalCode,
    street: data.street,
    number: data.number,
    complement: data.complement ?? null,
    neighborhood: data.neighborhood,
    city: data.city,
    state: data.state,
  };
}

function createOrderItem(
  item: {
    variantId: string;
    quantity: number;
    variant: {
      productId: string;
      sku: string;
      title: string;
      attributes: unknown;
      weightInGrams: number | null;
      heightInMillimeters: number | null;
      widthInMillimeters: number | null;
      lengthInMillimeters: number | null;
      product: {
        name: string;
        weightInGrams: number | null;
        heightInMillimeters: number | null;
        widthInMillimeters: number | null;
        lengthInMillimeters: number | null;
      };
      priceInCents: number;
      promotionalPriceInCents: number | null;
      promotionStartsAt: Date | null;
      promotionEndsAt: Date | null;
    };
  },
  sellerId: string,
) {
  const unitPriceInCents = getCurrentPriceInCents(item.variant);
  return {
    sellerId,
    productId: item.variant.productId,
    variantId: item.variantId,
    productNameSnapshot: item.variant.product.name,
    variantDescriptionSnapshot: item.variant.title,
    skuSnapshot: item.variant.sku,
    attributesSnapshot: item.variant.attributes as Prisma.InputJsonValue,
    weightInGramsSnapshot: item.variant.weightInGrams ?? item.variant.product.weightInGrams,
    heightInMillimetersSnapshot: item.variant.heightInMillimeters ?? item.variant.product.heightInMillimeters,
    widthInMillimetersSnapshot: item.variant.widthInMillimeters ?? item.variant.product.widthInMillimeters,
    lengthInMillimetersSnapshot: item.variant.lengthInMillimeters ?? item.variant.product.lengthInMillimeters,
    unitPriceInCents,
    quantity: item.quantity,
    totalAmountInCents: multiplyMoneyInCents(unitPriceInCents, item.quantity),
  };
}

async function reserveInventory(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  charge: Awaited<ReturnType<typeof calculateSellerCharges>>[number],
) {
  for (const item of charge.items) {
    const inventory = item.variant.inventory;
    if (!inventory)
      throw new ApplicationError({ code: "OUT_OF_STOCK", message: "Um produto ficou sem estoque.", statusCode: 409 });
    const updated = await tx.inventory.updateMany({
      where: { id: inventory.id, sellerId: charge.sellerId, availableQuantity: { gte: item.quantity } },
      data: {
        availableQuantity: { decrement: item.quantity },
        reservedQuantity: { increment: item.quantity },
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1)
      throw new ApplicationError({ code: "OUT_OF_STOCK", message: "Um produto ficou sem estoque.", statusCode: 409 });
    const after = await tx.inventory.findUniqueOrThrow({ where: { id: inventory.id } });
    await tx.inventoryMovement.create({
      data: {
        type: "RESERVATION",
        quantityChange: -item.quantity,
        availableQuantityAfter: after.availableQuantity,
        reservedQuantityAfter: after.reservedQuantity,
        referenceType: "ORDER",
        referenceId: charge.sellerId,
        reason: "Checkout reservation",
        inventoryId: inventory.id,
        variantId: item.variantId,
        sellerId: charge.sellerId,
      },
    });
  }
}

async function finalizePayment(input: {
  order: { orderId: string; paymentId: string; paymentTransactionId: string; totalAmountInCents: number };
  paymentResult: Awaited<ReturnType<typeof mercadoPagoProvider.createPayment>>;
}) {
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: input.order.orderId },
      include: { sellerOrders: { include: { items: true } } },
    });
    await tx.payment.update({
      where: { id: input.order.paymentId },
      data: {
        externalId: input.paymentResult.externalId,
        status: input.paymentResult.status,
        providerMetadata: input.paymentResult.providerMetadata as Prisma.InputJsonValue,
        authorizedAt: input.paymentResult.authorizedAt ?? null,
        paidAt: input.paymentResult.paidAt ?? null,
        failedAt: input.paymentResult.failedAt ?? null,
      },
    });
    await tx.paymentTransaction.update({
      where: { id: input.order.paymentTransactionId },
      data: {
        status: input.paymentResult.status === "APPROVED" ? "SUCCEEDED" : "PENDING",
        externalId: input.paymentResult.externalId,
        processedAt: input.paymentResult.paidAt ?? null,
      },
    });
    const paid = input.paymentResult.status === "APPROVED" || input.paymentResult.status === "AUTHORIZED";
    if (paid) await commitOrderReservations(tx, order.sellerOrders, order.id);
    await tx.order.update({ where: { id: input.order.orderId }, data: { status: paid ? "PAID" : "PENDING_PAYMENT" } });
    await tx.sellerOrder.updateMany({
      where: { orderId: input.order.orderId },
      data: { status: paid ? "PAID" : "PENDING_PAYMENT" },
    });
  });
}

async function releaseFailedCheckout(orderId: string, paymentId: string, cartId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { sellerOrders: { include: { items: true } } },
    });
    await releaseOrderReservations(tx, order.sellerOrders, orderId, "Payment provider failure");
    await tx.payment.update({ where: { id: paymentId }, data: { status: "FAILED", failedAt: new Date() } });
    await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
    await tx.sellerOrder.updateMany({ where: { orderId }, data: { status: "CANCELLED" } });
    await tx.cart.update({ where: { id: cartId }, data: { status: "ACTIVE" } });
  });
}

function createOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `MS-${date}-${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}
