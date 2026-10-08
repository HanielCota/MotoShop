import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sellerOrder: vi.fn(), returns: vi.fn(), cancellations: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({
  db: {
    sellerOrder: { aggregate: mocks.sellerOrder },
    returnRequest: { aggregate: mocks.returns },
    cancellationRequest: { aggregate: mocks.cancellations },
  },
}));

import { getSellerFinancialSummary } from "./seller-dashboard";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.sellerOrder.mockResolvedValue({
    _count: { _all: 2 },
    _sum: {
      itemsSubtotalInCents: 20_000,
      discountAmountInCents: 1_000,
      marketplaceCommissionInCents: 1_900,
      sellerNetAmountInCents: 17_100,
    },
  });
  mocks.returns.mockResolvedValue({ _sum: { amountInCents: 5_000 } });
  mocks.cancellations.mockResolvedValue({ _sum: { amountInCents: null } });
});

describe("getSellerFinancialSummary", () => {
  it("subtracts refunded returns from the seller net amount", async () => {
    await expect(getSellerFinancialSummary("seller-1")).resolves.toEqual({
      orderCount: 2,
      grossSalesInCents: 19_000,
      refundedAmountInCents: 5_000,
      netSalesInCents: 14_000,
      commissionInCents: 1_900,
      sellerNetAmountInCents: 12_100,
    });
  });

  it("scopes refunds to the seller and to seller orders still counted as sales", async () => {
    await getSellerFinancialSummary("seller-1");
    const saleStatuses = { status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] } };
    expect(mocks.returns).toHaveBeenCalledWith({
      where: { sellerId: "seller-1", status: "REFUNDED", sellerOrder: { sellerId: "seller-1", ...saleStatuses } },
      _sum: { amountInCents: true },
    });
    expect(mocks.cancellations).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ sellerId: "seller-1", status: "REFUNDED" }) }),
    );
  });
});
