/**
 * Lifecycle of the charge request recorded on the AUTHORIZATION PaymentTransaction
 * (`providerMetadata`, no dedicated columns):
 *
 * - `PREPARED`: order committed, the request was NOT sent to the provider yet.
 * - `SENT`: `requestSentAt` written immediately before calling `createPayment`.
 * - `REJECTED`: the provider answered with a definitive "not processed" rejection
 *   (400/401/403/422/429) for that request.
 *
 * Release rule (no provider-confirmed refusal needed): a pending order whose charge is
 * `PREPARED` (never sent, older than the grace period) or `REJECTED` (definitive rejection
 * whose local settlement failed) never produced a charge, so recovery may cancel it and
 * release stock and coupon idempotently. `SENT`, legacy rows without a marker, or any
 * payment with an external id stay "unknown": only a provider answer can settle them.
 */
export type PaymentRequestState = "PREPARED" | "SENT" | "REJECTED";

export const paymentRequestStateKey = "paymentRequestState";

/** Gives an in-flight checkout time to mark the request as SENT before recovery may cancel it. */
export const unsentPaymentGracePeriodMs = 2 * 60_000;

export function preparedPaymentRequestMetadata(): Record<string, unknown> {
  return { [paymentRequestStateKey]: "PREPARED" };
}

export function sentPaymentRequestMetadata(sentAt: Date): Record<string, unknown> {
  return { [paymentRequestStateKey]: "SENT", requestSentAt: sentAt.toISOString() };
}

export function rejectedPaymentRequestMetadata(input: {
  sentAt?: Date | undefined;
  rejectedAt: Date;
  httpStatus: number;
}): Record<string, unknown> {
  return {
    [paymentRequestStateKey]: "REJECTED",
    ...(input.sentAt ? { requestSentAt: input.sentAt.toISOString() } : {}),
    rejectedAt: input.rejectedAt.toISOString(),
    rejectionHttpStatus: input.httpStatus,
  };
}

export function readPaymentRequestState(metadata: unknown): PaymentRequestState | undefined {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) return undefined;
  const value = (metadata as Record<string, unknown>)[paymentRequestStateKey];
  return value === "PREPARED" || value === "SENT" || value === "REJECTED" ? value : undefined;
}

export type UnsentChargeDecision = "RELEASE_NEVER_SENT" | "RELEASE_REJECTED" | "WAIT" | "ASK_PROVIDER";

/** Decides whether a pending charge can be released locally without asking the provider. */
export function decideUnsentCharge(input: {
  paymentExternalId: string | null;
  paymentStatus: string;
  transaction: { status: string; providerMetadata: unknown; createdAt: Date } | undefined;
  now: Date;
}): UnsentChargeDecision {
  if (input.paymentExternalId !== null || input.paymentStatus !== "PENDING") return "ASK_PROVIDER";
  if (!input.transaction || input.transaction.status !== "PENDING") return "ASK_PROVIDER";
  const state = readPaymentRequestState(input.transaction.providerMetadata);
  if (state === "REJECTED") return "RELEASE_REJECTED";
  if (state === "PREPARED") {
    return input.now.getTime() - input.transaction.createdAt.getTime() >= unsentPaymentGracePeriodMs
      ? "RELEASE_NEVER_SENT"
      : "WAIT";
  }
  return "ASK_PROVIDER";
}
