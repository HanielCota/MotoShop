/**
 * L-06: dedupe Mercado Pago notifications by what the signature covers (data.id and
 * x-request-id). The body's top-level `id` is outside the HMAC, so a captured notification
 * replayed with another `id` would otherwise create a new WebhookEvent and a new job.
 */
export function signedNotificationId(paymentId: string, requestId: string): string {
  return `${paymentId.toLowerCase()}:${requestId}`;
}
