import type { ReturnStatus, SellerOrderStatus } from "@/generated/prisma/enums";

/**
 * "Vendidos" públicos de um produto: unidades de `OrderItem` cujo `SellerOrder` teve a venda
 * confirmada (pagamento aprovado e etapas seguintes), igual aos resumos financeiros do lojista.
 * Ficam de fora pedidos aguardando pagamento, com cancelamento solicitado ou cancelados, e as
 * unidades devolvidas cujo reembolso foi concluído.
 */
export const SOLD_SELLER_ORDER_STATUSES = [
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
] as const satisfies readonly SellerOrderStatus[];

/** Devoluções que revertem a venda (reembolso concluído). */
export const SALE_REVERSING_RETURN_STATUSES = ["REFUNDED"] as const satisfies readonly ReturnStatus[];

export function isSoldSellerOrderStatus(status: string): boolean {
  return (SOLD_SELLER_ORDER_STATUSES as readonly string[]).includes(status);
}

export function isSaleReversingReturnStatus(status: string): boolean {
  return (SALE_REVERSING_RETURN_STATUSES as readonly string[]).includes(status);
}

/** Unidades vendidas líquidas, nunca negativas. */
export function netUnitsSold(soldQuantity: number | null | undefined, refundedQuantity: number | null | undefined) {
  return Math.max((soldQuantity ?? 0) - (refundedQuantity ?? 0), 0);
}

export function formatUnitsSold(units: number): string | null {
  if (!Number.isInteger(units) || units <= 0) return null;
  return `${units.toLocaleString("pt-BR")} ${units === 1 ? "vendido" : "vendidos"}`;
}
