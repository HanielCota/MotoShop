import "server-only";

import { db } from "@/lib/database";

/** Pedidos da loja que contam como venda (pagos e não cancelados). */
const SALE_SELLER_ORDER_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

/**
 * Resumo financeiro da loja. Reembolsos de devoluções (e de cancelamentos cujo pedido ainda
 * conta como venda) são descontados do líquido; cancelamentos concluídos já ficam fora porque
 * o pedido da loja passa a CANCELLED.
 *
 * Ainda não existe estorno de comissão modelado: o valor reembolsado é descontado integralmente
 * do líquido do seller.
 */
export async function getSellerFinancialSummary(sellerId: string) {
  const saleSellerOrder = { status: { in: [...SALE_SELLER_ORDER_STATUSES] } };
  const [aggregate, refundedReturns, refundedCancellations] = await Promise.all([
    db.sellerOrder.aggregate({
      where: { sellerId, ...saleSellerOrder },
      _count: { _all: true },
      _sum: {
        itemsSubtotalInCents: true,
        discountAmountInCents: true,
        marketplaceCommissionInCents: true,
        sellerNetAmountInCents: true,
      },
    }),
    db.returnRequest.aggregate({
      where: { sellerId, status: "REFUNDED", sellerOrder: { sellerId, ...saleSellerOrder } },
      _sum: { amountInCents: true },
    }),
    db.cancellationRequest.aggregate({
      where: { sellerId, status: "REFUNDED", sellerOrder: { sellerId, ...saleSellerOrder } },
      _sum: { amountInCents: true },
    }),
  ]);

  const itemsSubtotalInCents = aggregate._sum.itemsSubtotalInCents ?? 0;
  const discountAmountInCents = aggregate._sum.discountAmountInCents ?? 0;
  const grossSalesInCents = itemsSubtotalInCents - discountAmountInCents;
  const refundedAmountInCents =
    (refundedReturns._sum.amountInCents ?? 0) + (refundedCancellations._sum.amountInCents ?? 0);
  return {
    orderCount: aggregate._count._all,
    grossSalesInCents,
    refundedAmountInCents,
    netSalesInCents: grossSalesInCents - refundedAmountInCents,
    commissionInCents: aggregate._sum.marketplaceCommissionInCents ?? 0,
    sellerNetAmountInCents: (aggregate._sum.sellerNetAmountInCents ?? 0) - refundedAmountInCents,
  };
}

export async function listSellerLowStockVariants(sellerId: string, threshold = 5, limit = 5) {
  return db.inventory.findMany({
    where: {
      sellerId,
      availableQuantity: { lte: threshold },
      variant: { sellerId, active: true, product: { sellerId } },
    },
    select: {
      id: true,
      availableQuantity: true,
      variant: {
        select: {
          id: true,
          title: true,
          sku: true,
          product: { select: { id: true, name: true, slug: true, status: true } },
        },
      },
    },
    orderBy: [{ availableQuantity: "asc" }, { updatedAt: "desc" }],
    take: limit,
  });
}
