import "server-only";
import { z } from "zod";

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
    // This adapter does not allocate funds to N recipients yet. An env flag alone
    // cannot safely enable a marketplace settlement contract.
    return sellerCount === 1;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    this.assertConfigured(input.sellerCount);
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
    this.assertConfigured(1);
    return mapPaymentResponse(await this.request(`/v1/payments/${encodeURIComponent(externalId)}`, { method: "GET" }));
  }

  async findPaymentByOrderNumber(orderNumber: string): Promise<GetPaymentResult | null> {
    this.assertConfigured(1);
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
        message: "Mais de uma cobrança encontrada. O pagamento precisa de revisão pela Moto Shop.",
      });
    }
    // Search is discovery only; retrieve the authoritative current payment state.
    return this.getPayment(String(response.results[0]!.id));
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
        message: "Mercado Pago ainda não está configurado no ambiente da Moto Shop.",
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
      signal: AbortSignal.timeout(15_000),
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
