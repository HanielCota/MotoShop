import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { logger } from "@/lib/logger";
import type { GetPaymentResult } from "@/shared/payment/payment-provider";
import { ApplicationError } from "@/shared/errors/application-error";
import { isMotoShopOrderNumber } from "@/modules/checkout/domain/order-number";
import { assertPaymentMatches } from "../domain/payment-match";
import { detectUnexplainedReversal, unexplainedReversalMessages } from "../domain/payment-reversal";
import { applyPaymentOutcome } from "./apply-payment-outcome";

export async function reconcileMercadoPagoPayment(input: {
  externalId: string;
  result: GetPaymentResult;
  webhookEventId?: string;
  expectedPaymentId?: string;
}): Promise<{ orderNumber: string; status: GetPaymentResult["status"] }> {
  const externalReference = readExternalReference(input.result.providerMetadata);
  // The Mercado Pago account may also receive payments from other integrations. A payment
  // whose external_reference is not a Moto Shop order number will never match an order:
  // acknowledge it instead of letting NOT_FOUND retries end as FAILED in the monitor.
  if ((!externalReference || !isMotoShopOrderNumber(externalReference)) && input.webhookEventId) {
    const known = await db.payment.findFirst({
      where: { provider: "MERCADO_PAGO", externalId: input.externalId },
      select: { id: true },
    });
    if (!known) {
      logger.info({
        event: "payment.webhook.foreign_reference_ignored",
        externalId: input.externalId,
        webhookEventId: input.webhookEventId,
      });
      await db.webhookEvent.update({
        where: { id: input.webhookEventId },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
          error: "Ignorado: a cobrança não pertence a um pedido do Moto Shop.",
        },
      });
      return { orderNumber: externalReference ?? "", status: input.result.status };
    }
  }
  const payment = await db.payment.findFirst({
    where: {
      provider: "MERCADO_PAGO",
      ...(input.expectedPaymentId ? { id: input.expectedPaymentId } : {}),
      OR: [
        { externalId: input.externalId },
        ...(externalReference ? [{ order: { orderNumber: externalReference } }] : []),
      ],
    },
    include: {
      order: { include: { sellerOrders: { include: { items: true } } } },
      transactions: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!payment) {
    throw new ApplicationError({
      code: "NOT_FOUND",
      message: `Pagamento Mercado Pago ${input.externalId} ainda não está associado a um pedido.`,
      statusCode: 404,
    });
  }

  const persistedStatus = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${payment.order.id} FOR UPDATE`;
    const freshPayment = await tx.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: { order: { include: { sellerOrders: { include: { items: true } } } }, transactions: true },
    });
    const isApproved = input.result.status === "APPROVED";
    assertPaymentMatches(freshPayment, input.result);
    if (
      input.result.externalId !== input.externalId ||
      (freshPayment.externalId && freshPayment.externalId !== input.externalId) ||
      (externalReference && externalReference !== freshPayment.order.orderNumber)
    ) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "A cobrança não corresponde ao pagamento deste pedido.",
      });
    }
    // Late/duplicate provider events must never regress fulfilled or cancelled orders.
    if (freshPayment.order.status !== "PENDING_PAYMENT") {
      const paymentWasAlreadySettled = ["APPROVED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(freshPayment.status);
      const lateApprovalRequiresReview = isApproved && !paymentWasAlreadySettled;
      if (lateApprovalRequiresReview && input.webhookEventId) {
        await tx.webhookEvent.update({
          where: { id: input.webhookEventId },
          data: {
            status: "FAILED",
            processedAt: null,
            error:
              "O provedor informou pagamento aprovado após o pedido sair de PENDING_PAYMENT. Revisão financeira manual necessária.",
          },
        });
      }
      const reversal = detectUnexplainedReversal({
        paymentStatus: freshPayment.status,
        paymentAmountInCents: freshPayment.amountInCents,
        transactions: freshPayment.transactions,
        result: input.result,
      });
      if (reversal) {
        // Chargeback, mediation or a refund the Moto Shop did not issue: never mirror it
        // silently. Leave the payment untouched and surface it in the webhook monitor.
        logger.warn({
          event: "payment.unexplained_reversal",
          kind: reversal,
          orderId: freshPayment.order.id,
          paymentId: freshPayment.id,
          externalId: input.externalId,
          providerStatus: input.result.status,
        });
        if (input.webhookEventId)
          await tx.webhookEvent.update({
            where: { id: input.webhookEventId },
            data: { status: "FAILED", processedAt: null, error: unexplainedReversalMessages[reversal] },
          });
        return freshPayment.status;
      }
      const isRefundUpdate =
        ["APPROVED", "PARTIALLY_REFUNDED"].includes(freshPayment.status) &&
        ["PARTIALLY_REFUNDED", "REFUNDED"].includes(input.result.status);
      if (isRefundUpdate) {
        // Refund fulfillment is handled by the returns/cancellations workflows.
        // Still mirror the financial status without replaying stock or delivery changes.
        await tx.payment.update({
          where: { id: freshPayment.id },
          data: {
            status: input.result.status,
            providerMetadata: input.result.providerMetadata as Prisma.InputJsonValue,
          },
        });
      }
      if (input.webhookEventId && !lateApprovalRequiresReview)
        await tx.webhookEvent.update({
          where: { id: input.webhookEventId },
          data: { status: "PROCESSED", processedAt: new Date(), error: null },
        });
      return isRefundUpdate ? input.result.status : freshPayment.status;
    }

    if (input.result.status === "PARTIALLY_REFUNDED") {
      // Partially refunded before the approval was settled here: neither PAID nor CANCELLED
      // is safe automatically. Keep the order untouched and surface it for manual review.
      logger.warn({
        event: "payment.partially_refunded_before_settlement",
        orderId: freshPayment.order.id,
        externalId: input.externalId,
      });
      if (input.webhookEventId)
        await tx.webhookEvent.update({
          where: { id: input.webhookEventId },
          data: {
            status: "FAILED",
            processedAt: null,
            error:
              "O provedor informou reembolso parcial de um pedido ainda aguardando pagamento. Revisão financeira manual necessária.",
          },
        });
      return freshPayment.status;
    }

    const transaction =
      freshPayment.transactions.find((candidate) => candidate.type === "AUTHORIZATION") ?? freshPayment.transactions[0];
    await applyPaymentOutcome(tx, {
      order: freshPayment.order,
      paymentId: freshPayment.id,
      transactionId: transaction?.id,
      result: { ...input.result, externalId: input.externalId },
      releaseReason:
        input.result.status === "REFUNDED" ? "Payment refunded or charged back" : "Payment failed or cancelled",
    });

    if (input.webhookEventId) {
      await tx.webhookEvent.update({
        where: { id: input.webhookEventId },
        data: { status: "PROCESSED", processedAt: new Date(), error: null },
      });
    }
    return input.result.status;
  });

  return { orderNumber: payment.order.orderNumber, status: persistedStatus };
}

function readExternalReference(metadata: Record<string, unknown>): string | undefined {
  const value = metadata.external_reference;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
