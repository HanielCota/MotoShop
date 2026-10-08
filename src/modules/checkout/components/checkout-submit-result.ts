import type { CheckoutActionState } from "../actions/checkout-actions";

const terminalStatuses = new Set(["FAILED", "CANCELLED", "CANCELED", "REJECTED", "DECLINED", "REFUSED"]);
const terminalCodes = new Set(["PAYMENT_REJECTED", "PAYMENT_DECLINED", "PAYMENT_CANCELLED", "PAYMENT_FAILED"]);
const terminalMessage = /\b(recusad[oa]|rejeitad[oa]|cancelad[oa]|negad[oa]|não aprovad[oa])\b/i;

/** Campos que a action pode passar a devolver; lidos de forma defensiva (todos opcionais). */
type CheckoutResultSignals = CheckoutActionState & {
  status?: unknown;
  paymentStatus?: unknown;
  code?: unknown;
  terminal?: unknown;
  retryable?: unknown;
};

/**
 * Indica uma falha DEFINITIVA da tentativa (pagamento recusado/cancelado). Nesses casos a
 * chave de idempotência deve ser descartada, senão um novo envio devolveria o pedido cancelado.
 * Falhas incertas (timeout, rede) NÃO são terminais: reenviar com a mesma chave evita cobrança dupla.
 */
export function isTerminalCheckoutFailure(result: CheckoutActionState): boolean {
  // Sinal explícito devolvido pela action quando o cartão é recusado e o pedido cancelado.
  if (result.paymentDeclined === true) return true;
  const signals = result as CheckoutResultSignals;
  if (signals.terminal === true || signals.retryable === false) return true;
  for (const value of [signals.paymentStatus, signals.status]) {
    if (typeof value === "string" && terminalStatuses.has(value.toUpperCase())) return true;
  }
  if (typeof signals.code === "string" && terminalCodes.has(signals.code.toUpperCase())) return true;
  return typeof result.error === "string" && terminalMessage.test(result.error);
}
