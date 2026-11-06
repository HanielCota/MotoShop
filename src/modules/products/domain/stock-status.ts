/**
 * Stock notice shoppers see. Unlike the seller's operational alert ("Estoque baixo" in the Central do
 * Lojista), this threshold decides when a product shows "Últimas unidades". Both come from
 * Admin › Configurações › Limites.
 */
export type PublicStockStatus = "out-of-stock" | "last-units" | "in-stock";

/**
 * Classifies the stock a shopper sees.
 *
 * @param availableQuantity - Units available to buy.
 * @param lastUnitsThreshold - Units at or below which the product shows "Últimas unidades".
 */
export function getPublicStockStatus(availableQuantity: number, lastUnitsThreshold: number): PublicStockStatus {
  if (Number.isFinite(availableQuantity) === false || availableQuantity <= 0) return "out-of-stock";
  return availableQuantity <= lastUnitsThreshold ? "last-units" : "in-stock";
}

export const publicStockStatusLabel: Record<PublicStockStatus, string> = {
  "out-of-stock": "Esgotado",
  "last-units": "Últimas unidades",
  "in-stock": "Em estoque",
};
