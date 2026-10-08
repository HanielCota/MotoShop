import { ApplicationError } from "@/shared/errors/application-error";

/**
 * Chaves de idempotência por tentativa de reembolso de uma solicitação (cancelamento/devolução).
 *
 * - Tentativa 1 usa a chave base (`cancellation-refund:<id>`), preservando registros antigos.
 * - Tentativas seguintes usam `<base>:retry-<n>`, onde `n` é o número da nova tentativa menos um.
 *
 * Uma nova chave só é gerada quando TODAS as tentativas anteriores estão `FAILED` (o provedor
 * recusou definitivamente, então nenhum dinheiro foi movimentado). Se existir uma tentativa
 * `SUCCEEDED` ou `PENDING`, a mesma chave é reutilizada para que `refundPayment` devolva o
 * resultado já confirmado ou reconcilie a pendência com o provedor — nunca um segundo reembolso.
 */
export const MAX_REFUND_ATTEMPTS = 5;

export type RefundAttemptTransaction = {
  idempotencyKey: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
};

export type RefundAttemptPlan = {
  idempotencyKey: string;
  attempt: number;
  /** true quando a chave já possui transação PENDING/SUCCEEDED e deve apenas ser reutilizada. */
  resumesExisting: boolean;
};

export function cancellationRefundBaseKey(cancellationRequestId: string): string {
  return `cancellation-refund:${cancellationRequestId}`;
}

export function returnRefundBaseKey(returnRequestId: string): string {
  return `return-refund:${returnRequestId}`;
}

export function refundAttemptKey(baseKey: string, attempt: number): string {
  if (!Number.isInteger(attempt) || attempt < 1) throw new RangeError("attempt must be a positive integer");
  return attempt === 1 ? baseKey : `${baseKey}:retry-${attempt - 1}`;
}

export function refundAttemptRetryPrefix(baseKey: string): string {
  return `${baseKey}:retry-`;
}

/** Retorna o número da tentativa representado pela chave, ou null se a chave não pertence à base. */
export function parseRefundAttempt(baseKey: string, idempotencyKey: string): number | null {
  if (idempotencyKey === baseKey) return 1;
  const prefix = refundAttemptRetryPrefix(baseKey);
  if (!idempotencyKey.startsWith(prefix)) return null;
  const suffix = idempotencyKey.slice(prefix.length);
  if (!/^[1-9]\d*$/.test(suffix)) return null;
  return Number(suffix) + 1;
}

export function planRefundAttempt(baseKey: string, transactions: RefundAttemptTransaction[]): RefundAttemptPlan {
  const attempts = transactions
    .map((transaction) => ({ ...transaction, attempt: parseRefundAttempt(baseKey, transaction.idempotencyKey) }))
    .filter((entry): entry is RefundAttemptTransaction & { attempt: number } => entry.attempt !== null)
    .sort((a, b) => b.attempt - a.attempt);

  const reusable =
    attempts.find((entry) => entry.status === "SUCCEEDED") ?? attempts.find((entry) => entry.status === "PENDING");
  if (reusable) return { idempotencyKey: reusable.idempotencyKey, attempt: reusable.attempt, resumesExisting: true };

  const nextAttempt = (attempts[0]?.attempt ?? 0) + 1;
  if (nextAttempt > MAX_REFUND_ATTEMPTS) {
    throw new ApplicationError({
      code: "CONFLICT",
      message:
        "O limite de tentativas de reembolso foi atingido. Verifique o pagamento no provedor antes de prosseguir.",
      statusCode: 409,
    });
  }
  return { idempotencyKey: refundAttemptKey(baseKey, nextAttempt), attempt: nextAttempt, resumesExisting: false };
}
