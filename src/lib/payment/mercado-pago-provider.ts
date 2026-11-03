import "server-only";
import { z } from "zod";

import { env } from "@/config/env";
import { ApplicationError } from "@/shared/errors/application-error";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  GetPaymentResult,
  PaymentProvider,
  RefundPaymentInput,
} from "@/shared/payment/payment-provider";

import { mercadoPagoRequest } from "./mercado-pago/http";
import { mapPaymentResponse, mapRefundResponse } from "./mercado-pago/mappers";
import { pixExpirationDate } from "./mercado-pago/pix-expiration";
import { singleAccountSellerId } from "./mercado-pago/single-account-mode";

const SINGLE_SELLER = 1;

/**
 * Mercado Pago adapter: input validation and endpoint orchestration only.
 * HTTP + error classification live in ./mercado-pago/http.ts, response mapping in ./mercado-pago/mappers.ts.
 */
export class MercadoPagoProvider implements PaymentProvider {
  supportsSellers(sellerIds: readonly string[]): boolean {
    // The marketplace has no seller-linked Mercado Pago OAuth connection yet.
    // A platform token plus application_fee is not a safe substitute for it.
    // Until then, the only charge allowed is the single-account one: one configured store, nothing to split.
    const allowedSellerId = this.singleAccountSellerId();
    if (allowedSellerId == null) return false;

    return sellerIds.length === SINGLE_SELLER && sellerIds[0] === allowedSellerId;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    this.assertConfigured();
    if (!this.supportsSellers(input.sellerIds)) {
      throw new ApplicationError({
        code: "CONFIGURATION_ERROR",
        message:
          input.sellerIds.length > 1
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
    const response = await mercadoPagoRequest("/v1/payments", {
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
        // An unpaid Pix must not hold stock and coupons forever (M-06).
        ...(input.paymentMethodId === "pix" ? { date_of_expiration: pixExpirationDate(new Date()) } : {}),
        ...(env.MERCADO_PAGO_NOTIFICATION_URL ? { notification_url: env.MERCADO_PAGO_NOTIFICATION_URL } : {}),
        // The platform's own account charges itself: a marketplace fee only exists with a seller's token.
        ...(input.applicationFeeInCents !== undefined && this.singleAccountSellerId() == null
          ? { application_fee: input.applicationFeeInCents / 100 }
          : {}),
      },
    });

    return mapPaymentResponse(response);
  }

  async getPayment(externalId: string): Promise<GetPaymentResult> {
    this.assertConfigured();
    return mapPaymentResponse(
      await mercadoPagoRequest(`/v1/payments/${encodeURIComponent(externalId)}`, { method: "GET" }),
    );
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
      .parse(await mercadoPagoRequest(`/v1/payments/search?${query}`, { method: "GET" }));
    if (response.paging.total === 0 && response.results.length === 0) return null;
    const [match] = response.results;
    if (response.paging.total !== 1 || response.results.length !== 1 || !match) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "Mais de uma cobrança encontrada. O pagamento precisa de revisão pelo Moto Shop.",
      });
    }
    // Search is discovery only; retrieve the authoritative current payment state.
    return this.getPayment(String(match.id));
  }

  async refund(input: RefundPaymentInput): Promise<CreatePaymentResult> {
    this.assertConfigured();
    const response = await mercadoPagoRequest(`/v1/payments/${encodeURIComponent(input.externalId)}/refunds`, {
      method: "POST",
      headers: { "X-Idempotency-Key": input.idempotencyKey },
      ...(input.amountInCents !== undefined ? { body: { amount: input.amountInCents / 100 } } : {}),
    });

    return mapRefundResponse(response);
  }

  private singleAccountSellerId(): string | null {
    return singleAccountSellerId({
      sellerId: env.MERCADO_PAGO_SINGLE_ACCOUNT_SELLER_ID,
      testDatabaseHost: env.MERCADO_PAGO_TEST_MODE_DATABASE_HOST,
      databaseUrl: env.DATABASE_URL,
      accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
      publicKey: env.MERCADO_PAGO_PUBLIC_KEY,
      deploymentEnvironment: env.VERCEL_ENV,
    });
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
}

export const mercadoPagoProvider = new MercadoPagoProvider();
