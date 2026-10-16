import type { InventoryMovementType } from "@/generated/prisma/enums";

/**
 * Ajuste manual do lojista (UX-10): entrada e saída somam ou tiram a quantidade informada;
 * correção recebe o total contado e o sistema calcula a diferença.
 */
export const manualAdjustmentKinds = ["IN", "OUT", "CORRECTION"] as const;
export type ManualAdjustmentKind = (typeof manualAdjustmentKinds)[number];

export type ManualAdjustment = Readonly<{
  kind: ManualAdjustmentKind;
  quantity: number;
  note?: string | undefined;
}>;

export const MANUAL_ADJUSTMENT_NOTE_MAX_LENGTH = 200;

export const manualAdjustmentMovementTypes: Record<ManualAdjustmentKind, InventoryMovementType> = {
  IN: "MANUAL_IN",
  OUT: "MANUAL_OUT",
  CORRECTION: "CORRECTION",
};

const defaultReasons: Record<ManualAdjustmentKind, string> = {
  IN: "Entrada manual pelo lojista",
  OUT: "Saída manual pelo lojista",
  CORRECTION: "Correção de contagem pelo lojista",
};

export function isManualAdjustmentKind(value: unknown): value is ManualAdjustmentKind {
  return typeof value === "string" && (manualAdjustmentKinds as readonly string[]).includes(value);
}

/** Mesma regra no navegador e no servidor; `null` quando o ajuste é válido. */
export function validateManualAdjustment(adjustment: ManualAdjustment): string | null {
  if (!Number.isSafeInteger(adjustment.quantity)) return "Informe uma quantidade em números inteiros.";
  if (adjustment.kind === "CORRECTION" && adjustment.quantity < 0) return "A quantidade contada não pode ser negativa.";
  if (adjustment.kind !== "CORRECTION" && adjustment.quantity <= 0) return "Informe uma quantidade maior que zero.";
  if ((adjustment.note?.length ?? 0) > MANUAL_ADJUSTMENT_NOTE_MAX_LENGTH) {
    return `Use no máximo ${MANUAL_ADJUSTMENT_NOTE_MAX_LENGTH} caracteres na observação.`;
  }
  return null;
}

/** Diferença a aplicar no saldo disponível atual. */
export function getManualAdjustmentChange(adjustment: ManualAdjustment, availableQuantity: number): number {
  if (adjustment.kind === "IN") return adjustment.quantity;
  if (adjustment.kind === "OUT") return -adjustment.quantity;
  return adjustment.quantity - availableQuantity;
}

export function getManualAdjustmentReason(adjustment: ManualAdjustment): string {
  const note = adjustment.note?.trim();
  return note ? note : defaultReasons[adjustment.kind];
}

/** Converte o texto do campo sem aceitar vazio como zero. */
export function parseManualAdjustmentQuantity(value: string): number {
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}
