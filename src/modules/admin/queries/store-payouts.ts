import "server-only";

import { db } from "@/lib/database";

import { buildStorePayoutReport, type PayoutRefund, type StorePayoutSales } from "../domain/store-payouts";
import { completedRefundsIn, confirmedSellerOrdersIn } from "./sales-summary";
import type { SalesDateRange } from "./sales-period";

async function listStorePayoutSales(range: SalesDateRange): Promise<StorePayoutSales[]> {
  const groups = await db.sellerOrder.groupBy({
    by: ["sellerId"],
    where: confirmedSellerOrdersIn(range),
    _count: { _all: true },
    _sum: {
      itemsSubtotalInCents: true,
      sellerDiscountInCents: true,
      marketplaceCommissionInCents: true,
      sellerNetAmountInCents: true,
      customerShippingAmountInCents: true,
    },
  });

  return groups.map((group) => ({
    sellerId: group.sellerId,
    orderCount: group._count._all,
    itemsSubtotalInCents: group._sum.itemsSubtotalInCents ?? 0,
    sellerDiscountInCents: group._sum.sellerDiscountInCents ?? 0,
    marketplaceCommissionInCents: group._sum.marketplaceCommissionInCents ?? 0,
    sellerNetAmountInCents: group._sum.sellerNetAmountInCents ?? 0,
    customerShippingAmountInCents: group._sum.customerShippingAmountInCents ?? 0,
  }));
}

/** The post-sale flow records the seller order in the refund metadata; anything else is not a seller order id. */
function recordedSellerOrderId(providerMetadata: unknown): string | null {
  if (providerMetadata == null || typeof providerMetadata !== "object" || Array.isArray(providerMetadata)) return null;

  const sellerOrderId: unknown = Reflect.get(providerMetadata, "sellerOrderId");
  return typeof sellerOrderId === "string" && sellerOrderId.trim() !== "" ? sellerOrderId : null;
}

async function listPayoutRefunds(range: SalesDateRange): Promise<PayoutRefund[]> {
  const refunds = await db.paymentTransaction.findMany({
    where: completedRefundsIn(range),
    select: {
      amountInCents: true,
      providerMetadata: true,
      payment: { select: { order: { select: { sellerOrders: { select: { id: true, sellerId: true } } } } } },
    },
  });

  return refunds.map((refund) => ({
    amountInCents: refund.amountInCents,
    sellerOrderId: recordedSellerOrderId(refund.providerMetadata),
    orderSellerOrders: refund.payment.order.sellerOrders,
  }));
}

async function loadStoreNames(sellerIds: readonly string[]): Promise<Map<string, string>> {
  if (sellerIds.length === 0) return new Map();

  const sellers = await db.seller.findMany({
    where: { id: { in: [...sellerIds] } },
    select: { id: true, store: { select: { name: true } } },
  });

  return new Map(sellers.map((seller) => [seller.id, seller.store?.name ?? "Loja sem nome"]));
}

/**
 * What the marketplace owes each store for the range: every store with a confirmed sale or a completed
 * refund in it, with the same sales and refund rules as the Admin sales summary.
 */
export async function getStorePayoutReport(range: SalesDateRange) {
  const [sales, refunds] = await Promise.all([listStorePayoutSales(range), listPayoutRefunds(range)]);
  const sellerIds = new Set(sales.map((store) => store.sellerId)).union(
    new Set(refunds.flatMap((refund) => refund.orderSellerOrders.map((sellerOrder) => sellerOrder.sellerId))),
  );

  return buildStorePayoutReport({ sales, refunds, storeNames: await loadStoreNames([...sellerIds]) });
}
