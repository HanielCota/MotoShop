import "server-only";

import { db } from "@/lib/database";
import { refundPayment } from "@/modules/payments/application/refund-payment";

import { planRefundAttempt, refundAttemptRetryPrefix, type RefundAttemptTransaction } from "../domain/refund-attempt";

export type RequestRefundInput = {
  baseKey: string;
  orderId: string;
  amountInCents: number;
  reason: string;
  sellerOrderId: string;
};

export type RequestRefundOutcome =
  | { kind: "REFUNDED"; idempotencyKey: string; attempt: number; transactionId: string }
  /** O pagamento já estava totalmente reembolsado no provedor (ex.: painel do Mercado Pago). */
  | { kind: "UPSTREAM_REFUNDED"; paymentId: string };

/**
 * Executa (ou retoma) o reembolso de uma solicitação de pós-venda com chave por tentativa.
 * Tentativas FAILED liberam uma nova chave; PENDING/SUCCEEDED são sempre reutilizadas.
 */
export async function refundPostSaleRequest(input: RequestRefundInput): Promise<RequestRefundOutcome> {
  const transactions = await db.paymentTransaction.findMany({
    where: {
      type: "REFUND",
      payment: { orderId: input.orderId },
      OR: [
        { idempotencyKey: input.baseKey },
        { idempotencyKey: { startsWith: refundAttemptRetryPrefix(input.baseKey) } },
      ],
    },
    select: { idempotencyKey: true, status: true },
  });
  const plan = planRefundAttempt(input.baseKey, transactions as RefundAttemptTransaction[]);

  if (!plan.resumesExisting) {
    const upstreamRefunded = await findUpstreamRefundedPayment(input.orderId);
    if (upstreamRefunded) return { kind: "UPSTREAM_REFUNDED", paymentId: upstreamRefunded.id };
  }

  const result = await refundPayment({
    orderId: input.orderId,
    amountInCents: input.amountInCents,
    idempotencyKey: plan.idempotencyKey,
    reason: input.reason,
    sellerOrderId: input.sellerOrderId,
  });
  return {
    kind: "REFUNDED",
    idempotencyKey: plan.idempotencyKey,
    attempt: plan.attempt,
    transactionId: result.transactionId,
  };
}

/** Metadados de auditoria do reembolso efetivamente usado para concluir a solicitação. */
export function refundAuditMetadata(refund: RequestRefundOutcome | null): Record<string, string | number | boolean> {
  if (!refund) return { refundSkipped: true };
  if (refund.kind === "UPSTREAM_REFUNDED") return { upstreamRefund: true, paymentId: refund.paymentId };
  return {
    refundIdempotencyKey: refund.idempotencyKey,
    refundAttempt: refund.attempt,
    refundTransactionId: refund.transactionId,
  };
}

async function findUpstreamRefundedPayment(orderId: string): Promise<{ id: string } | null> {
  const payments = await db.payment.findMany({
    where: { orderId, provider: "MERCADO_PAGO", status: { in: ["APPROVED", "PARTIALLY_REFUNDED", "REFUNDED"] } },
    select: { id: true, status: true },
    orderBy: { createdAt: "desc" },
  });
  // Só considera reembolsado no provedor quando não resta nenhum pagamento com saldo reembolsável.
  if (payments.some((payment) => payment.status !== "REFUNDED")) return null;
  return payments[0] ? { id: payments[0].id } : null;
}
