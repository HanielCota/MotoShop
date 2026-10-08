import "server-only";

import { db } from "@/lib/database";
import { MARKETPLACE_TIME_ZONE } from "@/lib/format";

export const LOW_STOCK_THRESHOLD = 5;

const confirmedSellerOrderStatuses = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

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

export async function countSellerLowStockVariants(sellerId: string, threshold = LOW_STOCK_THRESHOLD) {
  return db.inventory.count({
    where: {
      sellerId,
      availableQuantity: { lte: threshold },
      variant: { sellerId, active: true, product: { sellerId } },
    },
  });
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
