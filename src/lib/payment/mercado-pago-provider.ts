import "server-only";
import { z } from "zod";

import { env } from "@/config/env";
import { ApplicationError } from "@/shared/errors/application-error";
import { PaymentProviderError } from "@/shared/payment/payment-provider-error";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  GetPaymentResult,
  PaymentProvider,
  PaymentProviderStatus,
  RefundPaymentInput,
} from "@/shared/payment/payment-provider";

const DEFAULT_API_URL = "https://api.mercadopago.com";

export class MercadoPagoProvider implements PaymentProvider {
  supportsSellerCount(sellerCount: number): boolean {
    // The marketplace has no seller-linked Mercado Pago OAuth connection yet.
    // A platform token plus application_fee is not a safe substitute for it.
    if (!Number.isSafeInteger(sellerCount) || sellerCount < 1) return false;
    return false;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    this.assertConfigured();
    if (!this.supportsSellerCount(input.sellerCount)) {
      throw new ApplicationError({
        code: "CONFIGURATION_ERROR",
        message:
          input.sellerCount > 1
            ? "O checkout com vários lojistas ainda depende da habilitação do split 1:N no Mercado Pago."
            : "O lojista ainda não conectou uma conta Mercado Pago ao marketplace. Nenhuma cobrança foi criada.",
        statusCode: 503,
      });
    }
    if (env.MERCADO_PAGO_NOTIFICATION_URL && !env.MERCADO_PAGO_WEBHOOK_SECRET) {
      throw new ApplicationError({
        code: "CONFIGURATION_ERROR",
        message: "Configure a assinatura secreta antes de ativar a URL de webhook.",
      });
    }
    if (input.paymentMethodId !== "pix" && !input.paymentToken) {
      throw new ApplicationError({
        code: "VALIDATION_ERROR",
        message: "O cartão precisa ser validado pelo Mercado Pago.",
      });
    }
    if (input.paymentMethodId === "pix" && !input.payerTaxId) {
      throw new ApplicationError({
        code: "VALIDATION_ERROR",
        message: "Informe um CPF válido para gerar o pagamento via Pix.",
      });
    }
    const response = await this.request("/v1/payments", {
      method: "POST",
      headers: { "X-Idempotency-Key": input.idempotencyKey },
      body: {
        transaction_amount: input.amountInCents / 100,
        description: `Pedido ${input.orderNumber}`,
        external_reference: input.orderNumber,
        installments: input.installments ?? 1,
        payment_method_id: input.paymentMethodId,
        payer: {
          email: input.payerEmail,
          ...(input.payerTaxId ? { identification: { type: "CPF", number: input.payerTaxId } } : {}),
        },
        ...(input.paymentToken ? { token: input.paymentToken } : {}),
        ...(input.issuerId ? { issuer_id: input.issuerId } : {}),
        ...(env.MERCADO_PAGO_NOTIFICATION_URL ? { notification_url: env.MERCADO_PAGO_NOTIFICATION_URL } : {}),
        ...(input.applicationFeeInCents !== undefined ? { application_fee: input.applicationFeeInCents / 100 } : {}),
      },
    });

    return mapPaymentResponse(response);
  }

  async getPayment(externalId: string): Promise<GetPaymentResult> {
    this.assertConfigured();
    return mapPaymentResponse(await this.request(`/v1/payments/${encodeURIComponent(externalId)}`, { method: "GET" }));
  }

  async findPaymentByOrderNumber(orderNumber: string): Promise<GetPaymentResult | null> {
    this.assertConfigured();
    const query = new URLSearchParams({
      external_reference: orderNumber,
      sort: "date_created",
      criteria: "desc",
      limit: "2",
      offset: "0",
    });
    const response = z
      .object({
        paging: z.object({ total: z.number().int().nonnegative() }),
        results: z.array(z.object({ id: z.union([z.string().min(1), z.number().int().positive()]) })),
      })
      .parse(await this.request(`/v1/payments/search?${query}`, { method: "GET" }));
    if (response.paging.total === 0 && response.results.length === 0) return null;
    if (response.paging.total !== 1 || response.results.length !== 1) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "Mais de uma cobrança encontrada. O pagamento precisa de revisão pelo Moto Shop.",
      });
    }
    // Search is discovery only; retrieve the authoritative current payment state.
    return this.getPayment(String(response.results[0]!.id));
  }

  async refund(input: RefundPaymentInput): Promise<CreatePaymentResult> {
    this.assertConfigured();
    const response = await this.request(`/v1/payments/${encodeURIComponent(input.externalId)}/refunds`, {
      method: "POST",
      headers: { "X-Idempotency-Key": input.idempotencyKey },
      ...(input.amountInCents !== undefined ? { body: { amount: input.amountInCents / 100 } } : {}),
    });

    return mapPaymentResponse(response);
  }

  private assertConfigured(): void {
    if (!env.MERCADO_PAGO_ACCESS_TOKEN) {
      throw new ApplicationError({
        code: "CONFIGURATION_ERROR",
        message: "Mercado Pago ainda não está configurado no ambiente do Moto Shop.",
        statusCode: 503,
      });
    }
  }

  private async request(
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
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      const providerError = typeof payload.error === "string" ? payload.error : undefined;
      const providerCode = providerError && /^[a-z\d_.-]{1,80}$/i.test(providerError) ? providerError : undefined;
      const definitiveRejection = [400, 401, 403, 422].includes(response.status);
      throw new PaymentProviderError("O Mercado Pago recusou a operação de pagamento.", {
        httpStatus: response.status,
        outcome: definitiveRejection ? "DEFINITIVE_REJECTION" : "UNKNOWN",
        ...(providerCode ? { providerCode } : {}),
      });
    }

    return payload;
  }
}

function mapPaymentResponse(payload: Record<string, unknown>): CreatePaymentResult {
  const externalId = typeof payload.id === "number" || typeof payload.id === "string" ? String(payload.id) : undefined;
  if (!externalId) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "O Mercado Pago retornou um pagamento sem identificador.",
    });
  }

  const status =
    payload.status === "approved" && payload.status_detail === "partially_refunded"
      ? "PARTIALLY_REFUNDED"
      : mapStatus(payload.status);
  const now = new Date();
  return {
    externalId,
    status,
    providerMetadata: toSafePaymentMetadata(payload),
    ...(status === "AUTHORIZED" ? { authorizedAt: now } : {}),
    ...(status === "APPROVED" ? { paidAt: now } : {}),
    ...(status === "FAILED" || status === "CANCELLED" ? { failedAt: now } : {}),
  };
}

function toSafePaymentMetadata(payload: Record<string, unknown>): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  for (const key of ["external_reference", "currency_id", "payment_method_id", "status", "status_detail"]) {
    const value = payload[key];
    if (typeof value === "string") metadata[key] = value;
  }
  const transactionAmount = payload.transaction_amount;
  if (typeof transactionAmount === "number" && Number.isFinite(transactionAmount)) {
    metadata.transaction_amount = transactionAmount;
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function mapStatus(status: unknown): PaymentProviderStatus {
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
    default:
      return "PROCESSING";
  }
}

export const mercadoPagoProvider = new MercadoPagoProvider();
