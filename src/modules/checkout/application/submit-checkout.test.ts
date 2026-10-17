import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The simulated purchase of test products runs against the same database as the live
 * site, so these tests use a database where every write is recorded. The only write allowed is
 * emptying the customer's own cart; no order, reservation, coupon use, payment, e-mail or job.
 */
const mocks = vi.hoisted(() => {
  const writes: Array<{ model: string; method: string; args: unknown }> = [];
  const reads: Record<string, (args: unknown) => unknown> = {};
  const writeMethods = new Set(["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"]);
  const model = (name: string) =>
    new Proxy(
      {},
      {
        get: (_target, method: string) => async (args: unknown) => {
          if (writeMethods.has(method)) {
            writes.push({ model: name, method, args });
            return { count: 1 };
          }
          return reads[`${name}.${method}`]?.(args) ?? null;
        },
      },
    );
  const db = new Proxy(
    {},
    {
      get: (_target, property: string) => {
        if (property.startsWith("$"))
          return async (args: unknown) => {
            writes.push({ model: "$", method: property, args });
            return [];
          };
        return model(property);
      },
    },
  );
  return {
    db,
    writes,
    reads,
    createPayment: vi.fn(),
    quote: vi.fn(),
    findCoupon: vi.fn(async (): Promise<unknown> => undefined),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/config/env", () => ({ env: { BETTER_AUTH_SECRET: "secret" } }));
vi.mock("@/lib/database", () => ({ db: mocks.db }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/payment/mercado-pago-provider", () => ({
  mercadoPagoProvider: { createPayment: mocks.createPayment, supportsSellerCount: () => true },
}));
vi.mock("@/modules/payments/application/assert-payment-ready", () => ({
  assertPaymentConfigured: vi.fn(),
  assertPaymentCanHandleSellers: vi.fn(),
}));
vi.mock("@/modules/coupons/application/validate-coupon-for-customer", () => ({ findActiveCoupon: mocks.findCoupon }));
vi.mock("@/modules/coupons/queries/coupon-participation", () => ({ listActiveCouponParticipantSellerIds: vi.fn() }));
vi.mock("./shipping-quotes", () => ({ quoteShippingForCart: mocks.quote }));
// Imported for its session type; the real module builds the auth client from the environment.
vi.mock("@/modules/auth/application/authorization", () => ({ getCurrentSession: vi.fn() }));

import type { CheckoutInput } from "../schemas/checkout";
import { submitCheckout } from "./submit-checkout";

const data = {
  customerName: "Carla Mendes",
  customerEmail: "carla@example.test",
  customerPhone: "11900000000",
  customerTaxId: "52998224725",
  postalCode: "01310100",
  street: "Avenida Paulista",
  number: "1000",
  complement: "Apto 52",
  neighborhood: "Bela Vista",
  city: "São Paulo",
  state: "SP",
  paymentMethodId: "pix",
  checkoutIdempotencyKey: "00000000-0000-4000-8000-000000000001",
  shippingSelections: JSON.stringify({ czrvwseller00000000000001: "own-1" }),
} as CheckoutInput;
const input = { data, identity: { userId: "user-1" }, session: null };

function cartItem(id: string, options: { isDemo?: boolean; quantity?: number; stock?: number; price?: number } = {}) {
  return {
    id,
    quantity: options.quantity ?? 1,
    variant: {
      id: `variant-${id}`,
      title: "Preto · M",
      active: true,
      priceInCents: options.price ?? 10_000,
      promotionalPriceInCents: null,
      promotionStartsAt: null,
      promotionEndsAt: null,
      inventory: { availableQuantity: options.stock ?? 5 },
      product: {
        name: `Produto ${id}`,
        isDemo: options.isDemo ?? true,
        status: "APPROVED",
        sellerId: "czrvwseller00000000000001",
        storeId: "store-1",
        store: { name: "Garagem MX" },
        seller: { status: "ACTIVE", commissionBpsOverride: null, store: { name: "Garagem MX" } },
      },
    },
  };
}

function useCart(items: ReturnType<typeof cartItem>[]) {
  mocks.reads["cart.findFirst"] = () => ({ id: "cart-1", status: "ACTIVE", items });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.writes.length = 0;
  for (const key of Object.keys(mocks.reads)) delete mocks.reads[key];
  mocks.reads["marketplaceConfiguration.findUnique"] = () => ({ defaultCommissionBps: 1_200 });
  mocks.quote.mockResolvedValue([
    {
      sellerId: "czrvwseller00000000000001",
      storeName: "Garagem MX",
      quotes: [
        {
          provider: "OWN",
          serviceCode: "own-1",
          carrier: "Entrega da loja",
          service: "Grande São Paulo",
          priceInCents: 1_990,
          estimatedDeliveryDays: 3,
        },
      ],
    },
  ]);
});

describe("simulated purchase of test products", () => {
  it("answers with the summary and only empties the customer's own cart", async () => {
    useCart([cartItem("a", { quantity: 2 }), cartItem("b", { price: 5_000 })]);

    const submission = await submitCheckout(input);

    expect(submission.kind).toBe("simulated");
    if (submission.kind !== "simulated") return;
    expect(submission.purchase).toMatchObject({
      customer: { name: "Carla Mendes", email: "carla@example.test" },
      address: { street: "Avenida Paulista", number: "1000", city: "São Paulo", postalCode: "01310100" },
      paymentMethod: "pix",
      stores: [
        {
          storeName: "Garagem MX",
          items: [
            { name: "Produto a", quantity: 2, lineTotalInCents: 20_000 },
            { name: "Produto b", quantity: 1, lineTotalInCents: 5_000 },
          ],
          shipping: { label: "Entrega da loja · Grande São Paulo", estimatedDeliveryDays: 3, priceInCents: 1_990 },
        },
      ],
      totals: { itemCount: 3, itemsSubtotalInCents: 25_000, shippingInCents: 1_990, totalInCents: 26_990 },
    });
    expect(mocks.writes).toEqual([{ model: "cartItem", method: "deleteMany", args: { where: { cartId: "cart-1" } } }]);
    expect(mocks.createPayment).not.toHaveBeenCalled();
  });

  it("applies a coupon to the summary without recording any coupon use", async () => {
    useCart([cartItem("a")]);
    mocks.findCoupon.mockResolvedValueOnce({
      id: "coupon-1",
      code: "MOTO10",
      ownerType: "MARKETPLACE",
      sellerId: null,
      fundedBy: "MARKETPLACE",
      discountType: "PERCENTAGE",
      percentageBps: 1_000,
      fixedAmountInCents: null,
      minimumPurchaseInCents: 0,
    });

    const submission = await submitCheckout({ ...input, data: { ...data, couponCode: "MOTO10" } });

    expect(submission.kind === "simulated" && submission.purchase.totals).toMatchObject({
      discountInCents: 1_000,
      totalInCents: 10_990,
    });
    expect(mocks.writes.map((write) => write.model)).toEqual(["cartItem"]);
  });

  it.each([
    ["the card", { ...data, paymentMethodId: "visa", paymentToken: "a".repeat(32) } as CheckoutInput, [cartItem("a")]],
    ["missing stock", data, [cartItem("a", { quantity: 3, stock: 2 })]],
  ])("refuses %s without writing anything", async (_case, requestData, items) => {
    useCart(items);

    await expect(submitCheckout({ ...input, data: requestData })).rejects.toThrow();
    expect(mocks.writes).toEqual([]);
    expect(mocks.createPayment).not.toHaveBeenCalled();
  });

  it("never sends a cart with a real product to the simulation, and the real order refuses test products", async () => {
    useCart([cartItem("a"), cartItem("real", { isDemo: false })]);

    await expect(submitCheckout(input)).rejects.toThrow("Itens de demonstração não podem ser comprados.");
    expect(mocks.writes).toEqual([]);
    expect(mocks.createPayment).not.toHaveBeenCalled();
  });
});
