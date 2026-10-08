import "server-only";

import { env } from "@/config/env";
import { PaymentProviderError } from "@/shared/payment/payment-provider-error";

const DEFAULT_API_URL = "https://api.mercadopago.com";
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * HTTP statuses for which Mercado Pago did NOT process the operation, so no charge/refund
 * exists and the attempt can be settled as failed. 429 (rate limit) is rejected before
 * processing. 5xx, timeouts and network errors are UNKNOWN: the operation may exist.
 */
const DEFINITIVE_REJECTION_STATUSES: ReadonlySet<number> = new Set([400, 401, 403, 422, 429]);

export function classifyMercadoPagoHttpError(
  httpStatus: number,
  payload: Record<string, unknown>,
): PaymentProviderError {
  const providerError = typeof payload.error === "string" ? payload.error : undefined;
  const providerCode = providerError && /^[a-z\d_.-]{1,80}$/i.test(providerError) ? providerError : undefined;
  return new PaymentProviderError("O Mercado Pago recusou a operação de pagamento.", {
    httpStatus,
    outcome: DEFINITIVE_REJECTION_STATUSES.has(httpStatus) ? "DEFINITIVE_REJECTION" : "UNKNOWN",
    ...(providerCode ? { providerCode } : {}),
  });
}

export async function mercadoPagoRequest(
  path: string,
  input: { method: "GET" | "POST"; headers?: Record<string, string>; body?: Record<string, unknown> },
): Promise<Record<string, unknown>> {
  const response = await fetch(`${env.MERCADO_PAGO_API_URL ?? DEFAULT_API_URL}${path}`, {
    method: input.method,
    headers: {
      Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...input.headers,
    },
    ...(input.body ? { body: JSON.stringify(input.body) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw classifyMercadoPagoHttpError(response.status, payload);
  return payload;
}
