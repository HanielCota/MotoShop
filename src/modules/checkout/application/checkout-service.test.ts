import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    order: { findUniqueOrThrow: vi.fn() },
    paymentTransaction: { updateMany: vi.fn() },
  };
  return {
    tx,
    db: {
      paymentTransaction: { findUnique: vi.fn(), updateMany: vi.fn() },
      marketplaceConfiguration: { findUnique: vi.fn() },
      $transaction: vi.fn(),
    },
    loadCart: vi.fn(),
    reserve: vi.fn(),
    quote: vi.fn(),
    charges: vi.fn(),
    applyOutcome: vi.fn(),
    reactivate: vi.fn(),
    findCoupon: vi.fn(async (): Promise<unknown> => undefined),
    participants: vi.fn(),
  };
});
vi.mock("server-only", () => ({}));
vi.mock("@/config/env", () => ({ env: { BETTER_AUTH_SECRET: "secret" } }));
vi.mock("@/lib/database", () => ({ db: mocks.db }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/payment/mercado-pago-provider", () => ({ mercadoPagoProvider: {} }));
vi.mock("@/modules/cart/infrastructure/cart-access", () => ({ hashGuestToken: (token: string) => `hash:${token}` }));
vi.mock("@/modules/coupons/queries/coupon-participation", () => ({
  listActiveCouponParticipantSellerIds: mocks.participants,
}));
vi.mock("@/modules/coupons/application/validate-coupon-for-customer", () => ({
  findActiveCoupon: mocks.findCoupon,
}));
vi.mock("@/modules/payments/application/apply-payment-outcome", () => ({ applyPaymentOutcome: mocks.applyOutcome }));
vi.mock("./create-pending-order", () => ({
  loadCheckoutCart: mocks.loadCart,
  reserveCartAndCreateOrder: mocks.reserve,
}));
vi.mock("./shipping-quotes", () => ({ quoteShippingForCart: mocks.quote }));
vi.mock("../domain/seller-charges", () => ({ calculateSellerCharges: mocks.charges }));
vi.mock("./reactivate-cart", () => ({ reactivateCartAfterPaymentFailure: mocks.reactivate }));

import { PaymentProviderError } from "@/shared/payment/payment-provider-error";
import type { PaymentProvider } from "@/shared/payment/payment-provider";
import type { CheckoutInput } from "../schemas/checkout";
import { executeCheckout } from "./checkout-service";

const data = {
  customerEmail: "buyer@example.test",
  customerTaxId: "19119119100",
  paymentMethodId: "visa",
  paymentToken: "a".repeat(32),
  checkoutIdempotencyKey: "00000000-0000-4000-8000-000000000001",
  shippingSelections: "{}",
  postalCode: "01001000",
} as unknown as CheckoutInput;
const input = { data, identity: { userId: "user-1" }, session: null };
const pendingOrder = {
  orderId: "order-1",
  paymentId: "payment-1",
  paymentTransactionId: "tx-1",
  totalAmountInCents: 1_000,
  cartId: "cart-1",
};
const provider = (createPayment: PaymentProvider["createPayment"]): PaymentProvider => ({
  createPayment,
  getPayment: vi.fn(),
  refund: vi.fn(),
  supportsSellerCount: () => true,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.paymentTransaction.findUnique.mockResolvedValue(null);
  mocks.db.marketplaceConfiguration.findUnique.mockResolvedValue({ defaultCommissionBps: 1_000 });
  mocks.db.$transaction.mockImplementation((callback) => callback(mocks.tx));
  mocks.tx.order.findUniqueOrThrow.mockResolvedValue({
    id: "order-1",
    orderNumber: "MS-1",
    status: "PENDING_PAYMENT",
    sellerOrders: [],
  });
  mocks.loadCart.mockResolvedValue({ id: "cart-1", items: [] });
  mocks.quote.mockResolvedValue([]);
  mocks.charges.mockReturnValue([{ commissionInCents: 100 }]);
  mocks.reserve.mockResolvedValue(pendingOrder);
  mocks.tx.paymentTransaction.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.paymentTransaction.updateMany.mockResolvedValue({ count: 1 });
});

it("cancels the order, gives the cart back and flags the decline on a refused card", async () => {
  mocks.applyOutcome.mockResolvedValue("CANCELLED");
  const result = await executeCheckout(
    input,
    provider(vi.fn(async () => ({ externalId: "mp-1", status: "FAILED" as const, providerMetadata: {} }))),
  );
  expect(result).toMatchObject({ paymentDeclined: true });
  expect(mocks.applyOutcome).toHaveBeenCalledWith(
    mocks.tx,
    expect.objectContaining({ paymentId: "payment-1", transactionId: "tx-1", releaseReason: "Payment declined" }),
  );
  expect(mocks.reactivate).toHaveBeenCalledWith(mocks.tx, "cart-1");
});

it("does the same on a definitive provider rejection", async () => {
  mocks.applyOutcome.mockResolvedValue("CANCELLED");
  const result = await executeCheckout(
    input,
    provider(
      vi.fn(async () => {
        throw new PaymentProviderError("recusado", { httpStatus: 400, outcome: "DEFINITIVE_REJECTION" });
      }),
    ),
  );
  expect(result.paymentDeclined).toBe(true);
  expect(mocks.applyOutcome).toHaveBeenCalledWith(
    mocks.tx,
    expect.objectContaining({ result: expect.objectContaining({ status: "FAILED" }) }),
  );
  expect(mocks.reactivate).toHaveBeenCalledWith(mocks.tx, "cart-1");
});

it("keeps the cart converted and the order pending when the outcome is unknown", async () => {
  const result = await executeCheckout(
    input,
    provider(
      vi.fn(async () => {
        throw new Error("timeout");
      }),
    ),
  );
  expect(result).not.toHaveProperty("paymentDeclined");
  expect(mocks.applyOutcome).not.toHaveBeenCalled();
  expect(mocks.reactivate).not.toHaveBeenCalled();
});

it("does not reactivate the cart on approval and passes one checkout instant to pricing", async () => {
  mocks.applyOutcome.mockResolvedValue("PAID");
  const result = await executeCheckout(
    input,
    provider(vi.fn(async () => ({ externalId: "mp-1", status: "APPROVED" as const, providerMetadata: {} }))),
  );
  expect(result).not.toHaveProperty("paymentDeclined");
  expect(mocks.reactivate).not.toHaveBeenCalled();
  const now = mocks.charges.mock.calls[0]?.[0].now;
  expect(now).toBeInstanceOf(Date);
  expect(mocks.reserve).toHaveBeenCalledWith(expect.objectContaining({ now }));
});

it("reports a previously declined attempt again on an idempotent replay", async () => {
  mocks.db.paymentTransaction.findUnique.mockResolvedValue({
    payment: { status: "FAILED", order: { orderNumber: "MS-1", userId: "user-1", status: "CANCELLED" } },
  });
  await expect(executeCheckout(input, provider(vi.fn()))).resolves.toEqual({
    orderNumber: "MS-1",
    paymentDeclined: true,
  });
});

it("marks the request as SENT under the order lock before calling the provider", async () => {
  const createPayment = vi.fn(async () => {
    expect(mocks.tx.paymentTransaction.updateMany).toHaveBeenCalledWith({
      where: { id: "tx-1", status: "PENDING" },
      data: {
        providerMetadata: expect.objectContaining({ paymentRequestState: "SENT", requestSentAt: expect.any(String) }),
      },
    });
    return { externalId: "mp-1", status: "PENDING" as const, providerMetadata: {} };
  });
  mocks.applyOutcome.mockResolvedValue("PENDING_PAYMENT");
  await executeCheckout(input, provider(createPayment));
  expect(createPayment).toHaveBeenCalledTimes(1);
  expect(mocks.tx.$queryRaw).toHaveBeenCalled();
});

it("never sends the charge when recovery already released the order", async () => {
  mocks.tx.order.findUniqueOrThrow.mockResolvedValue({ status: "CANCELLED" });
  const createPayment = vi.fn();
  await expect(executeCheckout(input, provider(createPayment))).rejects.toThrow("Nenhuma cobrança");
  expect(createPayment).not.toHaveBeenCalled();
});

it("persists the definitive rejection before settling so recovery can release it if settlement fails", async () => {
  mocks.db.$transaction
    .mockImplementationOnce((callback) => callback(mocks.tx))
    .mockRejectedValueOnce(new Error("db down"));
  const result = await executeCheckout(
    input,
    provider(
      vi.fn(async () => {
        throw new PaymentProviderError("rate limited", { httpStatus: 429, outcome: "DEFINITIVE_REJECTION" });
      }),
    ),
  );
  expect(result).not.toHaveProperty("paymentDeclined");
  expect(mocks.db.paymentTransaction.updateMany).toHaveBeenCalledWith({
    where: { id: "tx-1", status: "PENDING" },
    data: {
      providerMetadata: expect.objectContaining({ paymentRequestState: "REJECTED", rejectionHttpStatus: 429 }),
    },
  });
  expect(mocks.applyOutcome).not.toHaveBeenCalled();
});

const approvedPayment = () =>
  provider(vi.fn(async () => ({ externalId: "mp-1", status: "APPROVED" as const, providerMetadata: {} })));

it("passes the sellers joined to a seller-funded campaign to the charge calculation", async () => {
  mocks.applyOutcome.mockResolvedValue("PAID");
  mocks.findCoupon.mockResolvedValue({ id: "coupon-1", ownerType: "MARKETPLACE", fundedBy: "SELLER" });
  mocks.participants.mockResolvedValue(["seller-a"]);

  await executeCheckout(input, approvedPayment());

  expect(mocks.participants).toHaveBeenCalledWith("coupon-1");
  expect(mocks.charges).toHaveBeenCalledWith(
    expect.objectContaining({ coupon: expect.objectContaining({ participatingSellerIds: ["seller-a"] }) }),
  );
});

it("does not look up participants for coupons that are not campaigns", async () => {
  mocks.applyOutcome.mockResolvedValue("PAID");
  mocks.findCoupon.mockResolvedValue({ id: "coupon-2", ownerType: "MARKETPLACE", fundedBy: "MARKETPLACE" });

  await executeCheckout(input, approvedPayment());

  expect(mocks.participants).not.toHaveBeenCalled();
});
