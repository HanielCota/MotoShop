import { beforeEach, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  sellerOrder: { groupBy: vi.fn() },
  paymentTransaction: { findMany: vi.fn() },
  seller: { findMany: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db }));

import { getStorePayoutReport } from "./store-payouts";

const range = { start: new Date("2026-10-01T03:00:00Z"), end: new Date("2026-11-01T03:00:00Z") };

beforeEach(() => {
  vi.clearAllMocks();
  db.sellerOrder.groupBy.mockResolvedValue([
    {
      sellerId: "seller-a",
      _count: { _all: 2 },
      _sum: {
        itemsSubtotalInCents: 30_000,
        sellerDiscountInCents: 1_000,
        marketplaceCommissionInCents: 3_480,
        sellerNetAmountInCents: 25_520,
        customerShippingAmountInCents: 2_500,
      },
    },
  ]);
  db.paymentTransaction.findMany.mockResolvedValue([
    {
      amountInCents: 4_990,
      providerMetadata: { reason: "Devolução", sellerOrderId: "so-b" },
      payment: {
        order: {
          sellerOrders: [
            { id: "so-a", sellerId: "seller-a", status: "DELIVERED" },
            { id: "so-b", sellerId: "seller-b", status: "CANCELLED" },
          ],
        },
      },
    },
    {
      amountInCents: 800,
      providerMetadata: null,
      payment: { order: { sellerOrders: [{ id: "so-c", sellerId: "seller-a", status: "DELIVERED" }] } },
    },
  ]);
  db.seller.findMany.mockResolvedValue([
    { id: "seller-a", store: { name: "Garagem MX" } },
    { id: "seller-b", store: { name: "Box 77" } },
  ]);
});

it("uses the sales summary rules: confirmed seller orders created in the range and refunds completed in it", async () => {
  await getStorePayoutReport(range);

  expect(db.sellerOrder.groupBy).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
        createdAt: { gte: range.start, lt: range.end },
      },
    }),
  );
  expect(db.paymentTransaction.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { type: "REFUND", status: "SUCCEEDED", processedAt: { gte: range.start, lt: range.end } },
    }),
  );
});

it("gives each refund to its store, including a store that only had a refund, and tells a cancelled order apart", async () => {
  const report = await getStorePayoutReport(range);

  expect(report.rows).toEqual([
    expect.objectContaining({ storeName: "Garagem MX", sellerNetAmountInCents: 25_520, refundedInCents: 800 }),
    expect.objectContaining({
      storeName: "Box 77",
      sellerNetAmountInCents: 0,
      refundedInCents: 4_990,
      refundedOutsidePayoutInCents: 4_990,
    }),
  ]);
  expect(report.totals.refundedInCents).toBe(5_790);
});
