import type { Prisma } from "@/generated/prisma/client";

/** Cancelamentos que tiram a compra do fluxo normal (em análise, aprovado ou reembolsado). */
const blockingCancellationStatuses = ["REQUESTED", "APPROVED", "REFUNDED"] as const;

/**
 * Somente compradores que receberam o produto avaliam (AGENTS.md §27): a loja precisa
 * estar entregue e o item não pode ter sido cancelado nem devolvido com reembolso.
 */
export function reviewEligibleOrderItemWhere(orderItemId: string, userId: string): Prisma.OrderItemWhereInput {
  return {
    id: orderItemId,
    sellerOrder: {
      status: "DELIVERED",
      order: { userId },
      cancellationRequests: { none: { status: { in: [...blockingCancellationStatuses] } } },
    },
    returnItems: { none: { returnRequest: { status: "REFUNDED" } } },
  };
}
