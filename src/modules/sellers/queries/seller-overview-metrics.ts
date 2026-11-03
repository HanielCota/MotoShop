import "server-only";

import { db } from "@/lib/database";
import { MARKETPLACE_TIME_ZONE } from "@/lib/format";
import { confirmedSellerOrderStatuses } from "@/modules/orders/domain/confirmed-sales";

export const LOW_STOCK_THRESHOLD = 5;

/** Início do mês corrente no fuso do marketplace (São Paulo, UTC-3 sem horário de verão). */
function startOfCurrentMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MARKETPLACE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  return new Date(Date.UTC(year, month - 1, 1, 3));
}

export async function countSellerOrdersToPrepare(sellerId: string) {
  return db.sellerOrder.count({ where: { sellerId, status: { in: ["PAID", "PROCESSING"] } } });
}

export async function countSellerUnansweredQuestions(sellerId: string) {
  return db.productQuestion.count({ where: { sellerId, hiddenAt: null, answeredAt: null } });
}

/** Variações ativas com estoque baixo (1 a 5) e esgotadas, como os filtros LOW e OUT da lista de produtos. */
export async function countSellerStockAlerts(sellerId: string, threshold = LOW_STOCK_THRESHOLD) {
  const activeVariant = { variant: { sellerId, active: true, product: { sellerId } } };
  const [low, out] = await Promise.all([
    db.inventory.count({ where: { sellerId, availableQuantity: { gt: 0, lte: threshold }, ...activeVariant } }),
    db.inventory.count({ where: { sellerId, availableQuantity: { lte: 0 }, ...activeVariant } }),
  ]);
  return { low, out };
}

export async function getSellerMonthNetSales(sellerId: string) {
  const aggregate = await db.sellerOrder.aggregate({
    where: {
      sellerId,
      status: { in: [...confirmedSellerOrderStatuses] },
      createdAt: { gte: startOfCurrentMonth() },
    },
    _count: { _all: true },
    _sum: { sellerNetAmountInCents: true },
  });
  return { orderCount: aggregate._count._all, netAmountInCents: aggregate._sum.sellerNetAmountInCents ?? 0 };
}
