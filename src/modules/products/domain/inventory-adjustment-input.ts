export const INVENTORY_ADJUSTMENT_ERROR = "Informe um ajuste inteiro diferente de zero.";

/** Mesma regra no servidor e no navegador (BUG-011): inteiro seguro e diferente de zero. */
export function validateInventoryAdjustment(quantityChange: number): string | null {
  if (!Number.isSafeInteger(quantityChange) || quantityChange === 0) return INVENTORY_ADJUSTMENT_ERROR;
  return null;
}

/** Converte o texto do campo sem aceitar vazio como zero. */
export function parseInventoryAdjustmentInput(value: string): number {
  const trimmed = value.trim();
  return /^-?\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}
