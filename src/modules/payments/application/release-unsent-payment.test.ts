import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    payment: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
  };
  return { tx, db: { $transaction: vi.fn() }, applyOutcome: vi.fn() };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: mocks.db }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("./apply-payment-outcome", () => ({ applyPaymentOutcome: mocks.applyOutcome }));

import { releaseUnsentPayment } from "./release-unsent-payment";

const now = new Date("2026-10-07T12:00:00.000Z");
const order = { id: "order-1", orderNumber: "MS-1", status: "PENDING_PAYMENT", sellerOrders: [] };
const payment = (metadata: unknown, overrides: Record<string, unknown> = {}) => ({
  id: "payment-1",
  externalId: null,
  status: "PENDING",
  order,
  transactions: [
    { id: "tx-1", status: "PENDING", providerMetadata: metadata, createdAt: new Date("2026-10-07T11:00:00.000Z") },
  ],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.$transaction.mockImplementation((callback) => callback(mocks.tx));
  mocks.tx.payment.findUnique.mockResolvedValue({ orderId: "order-1" });
});

it("cancels a never-sent charge under the order lock, releasing stock and coupon", async () => {
  mocks.tx.payment.findUniqueOrThrow.mockResolvedValue(payment({ paymentRequestState: "PREPARED" }));
  await expect(releaseUnsentPayment("payment-1", now)).resolves.toEqual({
    decision: "RELEASE_NEVER_SENT",
    released: true,
  });
  expect(mocks.tx.$queryRaw).toHaveBeenCalled();
  expect(mocks.applyOutcome).toHaveBeenCalledWith(
    mocks.tx,
    expect.objectContaining({
      paymentId: "payment-1",
      transactionId: "tx-1",
      result: expect.objectContaining({ status: "CANCELLED" }),
      releaseReason: "Payment request never sent to provider",
    }),
  );
});

it("settles a definitive rejection whose checkout settlement failed", async () => {
  mocks.tx.payment.findUniqueOrThrow.mockResolvedValue(
    payment({ paymentRequestState: "REJECTED", rejectionHttpStatus: 429 }),
  );
  await releaseUnsentPayment("payment-1", now);
  expect(mocks.applyOutcome).toHaveBeenCalledWith(
    mocks.tx,
    expect.objectContaining({
      result: expect.objectContaining({
        status: "FAILED",
        providerMetadata: expect.objectContaining({ rejectionHttpStatus: 429 }),
      }),
    }),
  );
});

it("never releases a sent request with unknown outcome", async () => {
  mocks.tx.payment.findUniqueOrThrow.mockResolvedValue(
    payment({ paymentRequestState: "SENT", requestSentAt: "2026-10-07T11:00:00.000Z" }),
  );
  await expect(releaseUnsentPayment("payment-1", now)).resolves.toEqual({ decision: "ASK_PROVIDER", released: false });
  expect(mocks.applyOutcome).not.toHaveBeenCalled();
});

it("is idempotent once the order left PENDING_PAYMENT", async () => {
  mocks.tx.payment.findUniqueOrThrow.mockResolvedValue(
    payment({ paymentRequestState: "PREPARED" }, { order: { ...order, status: "CANCELLED" } }),
  );
  await expect(releaseUnsentPayment("payment-1", now)).resolves.toMatchObject({ released: false });
  expect(mocks.applyOutcome).not.toHaveBeenCalled();
});
