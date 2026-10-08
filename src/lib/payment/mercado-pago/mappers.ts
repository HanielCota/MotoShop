import "server-only";

import { logger } from "@/lib/logger";
import { ApplicationError } from "@/shared/errors/application-error";
import type { CreatePaymentResult, PaymentProviderStatus } from "@/shared/payment/payment-provider";

/** Maps a Mercado Pago `/v1/payments` resource into the provider-neutral result. */
export function mapPaymentResponse(payload: Record<string, unknown>): CreatePaymentResult {
  const externalId = readId(payload.id);
  if (!externalId) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "O Mercado Pago retornou um pagamento sem identificador.",
    });
  }

  const status =
    payload.status === "approved" && payload.status_detail === "partially_refunded"
      ? "PARTIALLY_REFUNDED"
      : mapPaymentStatus(payload.status, externalId);
  return withStatusDates({ externalId, status, providerMetadata: toSafePaymentMetadata(payload) });
}

/**
 * Maps a Mercado Pago refund resource (`/v1/payments/{id}/refunds`), which is NOT a payment:
 * `id` is the refund id, `amount` the refunded value and `status` the refund status.
 */
export function mapRefundResponse(payload: Record<string, unknown>): CreatePaymentResult {
  const externalId = readId(payload.id);
  if (!externalId) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "O Mercado Pago retornou um reembolso sem identificador.",
    });
  }
  const metadata: Record<string, unknown> = { refund_id: externalId };
  const paymentId = readId(payload.payment_id);
  if (paymentId) metadata.payment_id = paymentId;
  if (typeof payload.status === "string") metadata.status = payload.status;
  if (typeof payload.amount === "number" && Number.isFinite(payload.amount)) metadata.amount = payload.amount;
  return withStatusDates({ externalId, status: mapRefundStatus(payload.status), providerMetadata: metadata });
}

export function toSafePaymentMetadata(payload: Record<string, unknown>): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  for (const key of ["external_reference", "currency_id", "payment_method_id", "status", "status_detail"]) {
    const value = payload[key];
    if (typeof value === "string") metadata[key] = value;
  }
  for (const key of ["transaction_amount", "transaction_amount_refunded"]) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) metadata[key] = value;
  }

  const pointOfInteraction = asRecord(payload.point_of_interaction);
  const transactionData = asRecord(pointOfInteraction?.transaction_data);
  if (transactionData) {
    const safeTransactionData: Record<string, string> = {};
    const qrCode = transactionData.qr_code;
    const qrImage = transactionData.qr_code_base64;
    if (typeof qrCode === "string" && qrCode.length <= 8_192) safeTransactionData.qr_code = qrCode;
    if (typeof qrImage === "string" && qrImage.length <= 1_000_000) {
      safeTransactionData.qr_code_base64 = qrImage;
    }
    if (Object.keys(safeTransactionData).length > 0) {
      metadata.point_of_interaction = { transaction_data: safeTransactionData };
    }
  }

  return metadata;
}

function withStatusDates(
  input: Omit<CreatePaymentResult, "authorizedAt" | "paidAt" | "failedAt">,
): CreatePaymentResult {
  const now = new Date();
  return {
    ...input,
    ...(input.status === "AUTHORIZED" ? { authorizedAt: now } : {}),
    ...(input.status === "APPROVED" ? { paidAt: now } : {}),
    ...(input.status === "FAILED" || input.status === "CANCELLED" ? { failedAt: now } : {}),
  };
}

function readId(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function mapRefundStatus(status: unknown): PaymentProviderStatus {
  switch (status) {
    case "approved":
      return "APPROVED";
    case "rejected":
      return "FAILED";
    case "cancelled":
      return "CANCELLED";
    case "pending":
      return "PENDING";
    default:
      return "PROCESSING";
  }
}

function mapPaymentStatus(status: unknown, externalId: string): PaymentProviderStatus {
  switch (status) {
    case "approved":
      return "APPROVED";
    case "authorized":
      return "AUTHORIZED";
    case "in_process":
      return "PROCESSING";
    case "pending":
      return "PENDING";
    case "cancelled":
      return "CANCELLED";
    case "rejected":
      return "FAILED";
    case "refunded":
      return "REFUNDED";
    case "charged_back":
      // There is no CHARGED_BACK PaymentStatus: a full chargeback means the money left the
      // marketplace, so it is handled like a full refund (terminal for pending orders). On a
      // PAID order the reconciliation flags it for manual review (raw status kept in metadata).
      logger.warn({ event: "mercado_pago.payment.charged_back", externalId });
      return "REFUNDED";
    case "in_mediation":
      // A dispute is open; the outcome is unknown, so keep it in processing but make it visible.
      logger.warn({ event: "mercado_pago.payment.in_mediation", externalId });
      return "PROCESSING";
    default:
      return "PROCESSING";
  }
}
