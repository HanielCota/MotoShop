import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  refund: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
  transactions: vi.fn(),
  payments: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/payments/application/refund-payment", () => ({ refundPayment: mocks.refund }));
vi.mock("@/lib/database", () => ({
  db: {
    returnRequest: { findUnique: mocks.find },
    paymentTransaction: { findMany: mocks.transactions },
    payment: { findMany: mocks.payments },
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback({ returnRequest: { updateMany: mocks.update }, auditLog: { create: mocks.audit } }),
  },
}));

import { refundReturnRequest } from "./refund-return";

const returned = {
  id: "return",
  status: "RETURNED",
  amountInCents: 100,
  orderId: "order-1",
  order: { orderNumber: "MS-1" },
  sellerOrder: { items: [{ totalAmountInCents: 100 }], itemsSubtotalInCents: 100, discountAmountInCents: 0 },
};
const input = { returnRequestId: "return", actorUserId: "admin" };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transactions.mockResolvedValue([]);
  mocks.payments.mockResolvedValue([{ id: "payment-1", status: "APPROVED" }]);
  mocks.refund.mockResolvedValue({ transactionId: "tx-1" });
  mocks.update.mockResolvedValue({ count: 1 });
});

it("blocks old return requests whose item snapshots omitted a coupon", async () => {
  mocks.find.mockResolvedValue({
    ...returned,
    sellerOrder: { items: [{ totalAmountInCents: 100 }], itemsSubtotalInCents: 100, discountAmountInCents: 50 },
  });
  await expect(refundReturnRequest(input)).rejects.toThrow("históricos");
  expect(mocks.refund).not.toHaveBeenCalled();
});

it("finishes a fully discounted return without sending a zero refund", async () => {
  mocks.find.mockResolvedValue({
    ...returned,
    amountInCents: 0,
    sellerOrder: { items: [{ totalAmountInCents: 0 }], itemsSubtotalInCents: 100, discountAmountInCents: 100 },
  });
  await expect(refundReturnRequest(input)).resolves.toEqual({ outcome: "REFUNDED", orderNumber: "MS-1" });
  expect(mocks.refund).not.toHaveBeenCalled();
  expect(mocks.audit).toHaveBeenCalled();
});

it("does not report success when the return state changed after the provider refund", async () => {
  mocks.find.mockResolvedValue(returned);
  mocks.update.mockResolvedValue({ count: 0 });
  await expect(refundReturnRequest(input)).rejects.toThrow("mudou de estado");
  expect(mocks.refund).toHaveBeenCalledOnce();
  expect(mocks.audit).not.toHaveBeenCalled();
});

it("retries a refund that the provider definitively rejected with a new attempt key", async () => {
  mocks.find.mockResolvedValue(returned);
  mocks.transactions.mockResolvedValue([{ idempotencyKey: "return-refund:return", status: "FAILED" }]);
  await expect(refundReturnRequest(input)).resolves.toEqual({ outcome: "REFUNDED", orderNumber: "MS-1" });
  expect(mocks.refund).toHaveBeenCalledWith(
    expect.objectContaining({ idempotencyKey: "return-refund:return:retry-1" }),
  );
  expect(mocks.audit).toHaveBeenCalledWith({
    data: expect.objectContaining({
      action: "RETURN_REFUNDED",
      metadata: expect.objectContaining({ refundAttempt: 2 }),
    }),
  });
});

it("is idempotent for an already refunded return", async () => {
  mocks.find.mockResolvedValue({ ...returned, status: "REFUNDED" });
  await expect(refundReturnRequest(input)).resolves.toEqual({ outcome: "ALREADY_REFUNDED", orderNumber: "MS-1" });
  expect(mocks.refund).not.toHaveBeenCalled();
});

it("requires the item to be received before refunding", async () => {
  mocks.find.mockResolvedValue({ ...returned, status: "APPROVED" });
  await expect(refundReturnRequest(input)).rejects.toThrow("recebimento");
});
