import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ transactions: vi.fn(), payments: vi.fn(), refund: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/payments/application/refund-payment", () => ({ refundPayment: mocks.refund }));
vi.mock("@/lib/database", () => ({
  db: { paymentTransaction: { findMany: mocks.transactions }, payment: { findMany: mocks.payments } },
}));

import { refundAuditMetadata, refundPostSaleRequest } from "./refund-request";

const input = {
  baseKey: "cancellation-refund:req",
  orderId: "order-1",
  amountInCents: 500,
  reason: "Cancelamento",
  sellerOrderId: "seller-order-1",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transactions.mockResolvedValue([]);
  mocks.payments.mockResolvedValue([{ id: "payment-1", status: "APPROVED" }]);
  mocks.refund.mockResolvedValue({ transactionId: "tx-1", paymentStatus: "PARTIALLY_REFUNDED" });
});

describe("refundPostSaleRequest", () => {
  it("uses the base key on the first attempt", async () => {
    await expect(refundPostSaleRequest(input)).resolves.toEqual({
      kind: "REFUNDED",
      idempotencyKey: "cancellation-refund:req",
      attempt: 1,
      transactionId: "tx-1",
    });
    expect(mocks.refund).toHaveBeenCalledWith({
      orderId: "order-1",
      amountInCents: 500,
      idempotencyKey: "cancellation-refund:req",
      reason: "Cancelamento",
      sellerOrderId: "seller-order-1",
    });
  });

  it("retries a definitively rejected refund with a new attempt key", async () => {
    mocks.transactions.mockResolvedValue([{ idempotencyKey: "cancellation-refund:req", status: "FAILED" }]);
    const result = await refundPostSaleRequest(input);
    expect(mocks.refund).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "cancellation-refund:req:retry-1" }),
    );
    expect(result).toMatchObject({ kind: "REFUNDED", attempt: 2 });
  });

  it("reuses a pending attempt even if the payment looks refunded upstream", async () => {
    mocks.transactions.mockResolvedValue([
      { idempotencyKey: "cancellation-refund:req", status: "FAILED" },
      { idempotencyKey: "cancellation-refund:req:retry-1", status: "PENDING" },
    ]);
    mocks.payments.mockResolvedValue([{ id: "payment-1", status: "REFUNDED" }]);
    await refundPostSaleRequest(input);
    expect(mocks.payments).not.toHaveBeenCalled();
    expect(mocks.refund).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "cancellation-refund:req:retry-1" }),
    );
  });

  it("closes without calling the provider when the payment was fully refunded upstream", async () => {
    mocks.transactions.mockResolvedValue([{ idempotencyKey: "cancellation-refund:req", status: "FAILED" }]);
    mocks.payments.mockResolvedValue([{ id: "payment-1", status: "REFUNDED" }]);
    await expect(refundPostSaleRequest(input)).resolves.toEqual({ kind: "UPSTREAM_REFUNDED", paymentId: "payment-1" });
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  it("does not treat the order as refunded while another payment still has balance", async () => {
    mocks.payments.mockResolvedValue([
      { id: "payment-2", status: "REFUNDED" },
      { id: "payment-1", status: "APPROVED" },
    ]);
    await refundPostSaleRequest(input);
    expect(mocks.refund).toHaveBeenCalledOnce();
  });

  it("builds audit metadata for each outcome", () => {
    expect(refundAuditMetadata(null)).toEqual({ refundSkipped: true });
    expect(refundAuditMetadata({ kind: "UPSTREAM_REFUNDED", paymentId: "p" })).toEqual({
      upstreamRefund: true,
      paymentId: "p",
    });
  });
});
