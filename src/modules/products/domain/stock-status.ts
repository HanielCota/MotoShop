/**
 * Aviso público de estoque (storefront). Diferente do alerta operacional do lojista
 * (`LOW_STOCK_THRESHOLD` em sellers), este limite decide quando o cliente vê "Últimas unidades".
 */
export const LAST_UNITS_THRESHOLD = 3;

export type PublicStockStatus = "out-of-stock" | "last-units" | "in-stock";

export function getPublicStockStatus(availableQuantity: number): PublicStockStatus {
  if (!Number.isFinite(availableQuantity) || availableQuantity <= 0) return "out-of-stock";
  return availableQuantity <= LAST_UNITS_THRESHOLD ? "last-units" : "in-stock";
}

export const publicStockStatusLabel: Record<PublicStockStatus, string> = {
  "out-of-stock": "Esgotado",
  "last-units": "Últimas unidades",
  "in-stock": "Em estoque",
};
