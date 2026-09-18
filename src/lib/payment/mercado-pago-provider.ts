import "server-only";

import { env } from "@/config/env";
import { ApplicationError } from "@/shared/errors/application-error";
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
    return sellerCount <= 1 || env.MERCADO_PAGO_MULTI_SELLER_ENABLED === true;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    this.assertConfigured(input.sellerCount);
    const response = await this.request("/v1/payments", {
      method: "POST",
      headers: { "X-Idempotency-Key": input.idempotencyKey },
      body: {
        transaction_amount: input.amountInCents / 100,
        description: `Pedido ${input.orderNumber}`,
        external_reference: input.orderNumber,
        installments: input.installments ?? 1,
        payment_method_id: input.paymentMethodId,
        payer: { email: input.payerEmail },
        ...(input.paymentToken ? { token: input.paymentToken } : {}),
        ...(input.applicationFeeInCents !== undefined ? { application_fee: input.applicationFeeInCents / 100 } : {}),
      },
    });

    return mapPaymentResponse(response);
  }

  async getPayment(externalId: string): Promise<GetPaymentResult> {
    this.assertConfigured(1);
    return mapPaymentResponse(await this.request(`/v1/payments/${encodeURIComponent(externalId)}`, { method: "GET" }));
  }

  async refund(input: RefundPaymentInput): Promise<CreatePaymentResult> {
    this.assertConfigured(1);
    const response = await this.request(`/v1/payments/${encodeURIComponent(input.externalId)}/refunds`, {
      method: "POST",
      headers: { "X-Idempotency-Key": input.idempotencyKey },
      ...(input.amountInCents !== undefined ? { body: { amount: input.amountInCents / 100 } } : {}),
    });

    return mapPaymentResponse(response);
  }

  private assertConfigured(sellerCount: number): void {
    if (!env.MERCADO_PAGO_ACCESS_TOKEN) {
      throw new ApplicationError({
        code: "CONFIGURATION_ERROR",
        message: "Mercado Pago ainda não está configurado no ambiente do MotoShop.",
        statusCode: 503,
      });
    }

    if (!this.supportsSellerCount(sellerCount)) {
      throw new ApplicationError({
        code: "CONFIGURATION_ERROR",
        message: "O checkout com múltiplos sellers depende da habilitação do split 1:N no Mercado Pago.",
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
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "O Mercado Pago recusou a operação de pagamento.",
        statusCode: response.status >= 500 ? 502 : 409,
        cause: payload,
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

  const status = mapStatus(payload.status);
  const now = new Date();
  return {
    externalId,
    status,
    providerMetadata: payload,
    ...(status === "AUTHORIZED" ? { authorizedAt: now } : {}),
    ...(status === "APPROVED" ? { paidAt: now } : {}),
    ...(status === "FAILED" || status === "CANCELLED" ? { failedAt: now } : {}),
  };
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
    default:
      return "PROCESSING";
  }
}

export const mercadoPagoProvider = new MercadoPagoProvider();
