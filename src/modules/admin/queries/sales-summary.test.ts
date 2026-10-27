import { beforeEach, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  sellerOrder: { groupBy: vi.fn() },
  order: { count: vi.fn(), groupBy: vi.fn() },
  orderItem: { groupBy: vi.fn(), findFirst: vi.fn() },
  paymentTransaction: { aggregate: vi.fn() },
  seller: { findMany: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db }));

import { getAdminSalesSummary } from "./sales-summary";

const range = { start: new Date("2026-10-01T03:00:00Z"), end: new Date("2026-10-27T03:00:00Z") };
const confirmedInRange = {
  status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
  createdAt: { gte: range.start, lt: range.end },
};

beforeEach(() => {
  vi.clearAllMocks();
  db.sellerOrder.groupBy.mockResolvedValue([
    {
      sellerId: "seller-1",
      _count: { _all: 2 },
      _sum: {
        itemsSubtotalInCents: 30_000,
        discountAmountInCents: 1_000,
        customerShippingAmountInCents: 2_500,
        sellerNetAmountInCents: 25_520,
        marketplaceCommissionInCents: 3_480,
      },
    },
  ]);
  db.order.count.mockResolvedValue(2);
  db.order.groupBy.mockResolvedValue([
    { status: "DELIVERED", _count: { _all: 2 } },
    { status: "PENDING_PAYMENT", _count: { _all: 4 } },
  ]);
  db.orderItem.groupBy.mockResolvedValue([
    { sellerId: "seller-1", skuSnapshot: "GMX-APEX-M", _sum: { quantity: 3, totalAmountInCents: 27_000 } },
  ]);
  db.orderItem.findFirst.mockResolvedValue({ productNameSnapshot: "Capacete Apex Pro" });
  db.paymentTransaction.aggregate.mockResolvedValue({ _count: { _all: 1 }, _sum: { amountInCents: 4_990 } });
  db.seller.findMany.mockResolvedValue([{ id: "seller-1", store: { name: "Garagem MX" } }]);
});

it("counts only confirmed seller orders of the period in sales, paid orders and products", async () => {
  await getAdminSalesSummary(range);

  expect(db.sellerOrder.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: confirmedInRange }));
  expect(db.order.count).toHaveBeenCalledWith({ where: { sellerOrders: { some: confirmedInRange } } });
  expect(db.orderItem.groupBy).toHaveBeenCalledWith(
    expect.objectContaining({ where: { sellerOrder: confirmedInRange }, take: 5 }),
  );
});

it("counts every order of the period by status and only the refunds that went through", async () => {
  await getAdminSalesSummary(range);

  expect(db.order.groupBy).toHaveBeenCalledWith(
    expect.objectContaining({ where: { createdAt: { gte: range.start, lt: range.end } } }),
  );
  expect(db.paymentTransaction.aggregate).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { type: "REFUND", status: "SUCCEEDED", createdAt: { gte: range.start, lt: range.end } },
    }),
  );
});

it("returns the figures in cents with the store and product names", async () => {
  const summary = await getAdminSalesSummary(range);

  expect(summary).toMatchObject({
    grossSalesInCents: 31_500,
    sellerNetAmountInCents: 25_520,
    marketplaceCommissionInCents: 3_480,
    paidOrderCount: 2,
    sellingStoreCount: 1,
    averageTicketInCents: 15_750,
    refunds: { count: 1, amountInCents: 4_990 },
    topStores: [{ sellerId: "seller-1", storeName: "Garagem MX", orderCount: 2, grossSalesInCents: 31_500 }],
    topProducts: [{ sku: "GMX-APEX-M", productName: "Capacete Apex Pro", quantity: 3, salesInCents: 27_000 }],
  });
});

it("skips the store lookup and has no average ticket when nothing sold", async () => {
  db.sellerOrder.groupBy.mockResolvedValue([]);
  db.order.count.mockResolvedValue(0);
  db.orderItem.groupBy.mockResolvedValue([]);

  const summary = await getAdminSalesSummary(range);

  expect(summary).toMatchObject({ grossSalesInCents: 0, averageTicketInCents: null, topStores: [], topProducts: [] });
  expect(db.seller.findMany).not.toHaveBeenCalled();
});
