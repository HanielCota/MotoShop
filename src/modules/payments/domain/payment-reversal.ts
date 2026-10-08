import type { GetPaymentResult } from "@/shared/payment/payment-provider";

export type UnexplainedReversalKind = "CHARGEBACK" | "MEDIATION" | "OUT_OF_BAND_REFUND";

export const unexplainedReversalMessages: Record<UnexplainedReversalKind, string> = {
  CHARGEBACK:
    "O provedor informou chargeback (contestação do comprador) em um pedido pago. Revisão financeira manual necessária; nenhum status foi alterado.",
  MEDIATION:
    "O provedor informou mediação aberta em um pedido pago. Revisão financeira manual necessária; nenhum status foi alterado.",
  OUT_OF_BAND_REFUND:
    "O provedor informou reembolso que não corresponde a nenhum reembolso registrado no Moto Shop. Revisão financeira manual necessária; nenhum status foi alterado.",
};

/**
 * Detects a reversal on an already PAID payment that the Moto Shop did not originate:
 * chargeback, mediation, or a refund not covered by internal REFUND transactions
 * (SUCCEEDED or still PENDING). Such events must not be mirrored silently.
 */
export function detectUnexplainedReversal(input: {
  paymentStatus: string;
  paymentAmountInCents: number;
  transactions: ReadonlyArray<{ type: string; status: string; amountInCents: number }>;
  result: Pick<GetPaymentResult, "status" | "providerMetadata">;
}): UnexplainedReversalKind | undefined {
  if (!["APPROVED", "PARTIALLY_REFUNDED"].includes(input.paymentStatus)) return undefined;
  const providerStatus = input.result.providerMetadata.status;
  if (providerStatus === "charged_back") return "CHARGEBACK";
  if (providerStatus === "in_mediation") return "MEDIATION";
  if (input.result.status !== "REFUNDED" && input.result.status !== "PARTIALLY_REFUNDED") return undefined;

  const internalRefundsInCents = input.transactions
    .filter((entry) => entry.type === "REFUND" && (entry.status === "SUCCEEDED" || entry.status === "PENDING"))
    .reduce((total, entry) => total + entry.amountInCents, 0);
  const refunded = input.result.providerMetadata.transaction_amount_refunded;
  const providerRefundedInCents =
    typeof refunded === "number" && Number.isFinite(refunded)
      ? Math.round(refunded * 100)
      : input.result.status === "REFUNDED"
        ? input.paymentAmountInCents
        : undefined;
  const explained =
    internalRefundsInCents > 0 &&
    (providerRefundedInCents === undefined || providerRefundedInCents <= internalRefundsInCents);
  return explained ? undefined : "OUT_OF_BAND_REFUND";
}
