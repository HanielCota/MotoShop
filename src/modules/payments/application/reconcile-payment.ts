import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { inngest } from "@/lib/inngest/client";
import {
  commitOrderReservations,
  releaseOrderReservations,
} from "@/modules/inventory/application/settle-order-inventory";
import type { GetPaymentResult } from "@/shared/payment/payment-provider";
import { ApplicationError } from "@/shared/errors/application-error";

export async function reconcileMercadoPagoPayment(input: {
  externalId: string;
  result: GetPaymentResult;
  webhookEventId?: string;
  expectedPaymentId?: string;
}): Promise<{ orderNumber: string; status: GetPaymentResult["status"] }> {
  const externalReference = readExternalReference(input.result.providerMetadata);
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
    const isFailed = input.result.status === "FAILED" || input.result.status === "CANCELLED";
    // Late/duplicate provider events must never regress fulfilled or cancelled orders.
    if (freshPayment.order.status !== "PENDING_PAYMENT") {
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
      if (input.webhookEventId)
        await tx.webhookEvent.update({
          where: { id: input.webhookEventId },
          data: { status: "PROCESSED", processedAt: new Date(), error: null },
        });
      return isRefundUpdate ? input.result.status : freshPayment.status;
    }

    await tx.payment.update({
      where: { id: freshPayment.id },
      data: {
        externalId: input.externalId,
        status: input.result.status,
        providerMetadata: input.result.providerMetadata as Prisma.InputJsonValue,
        authorizedAt: input.result.authorizedAt ?? null,
        paidAt: input.result.paidAt ?? null,
        failedAt: input.result.failedAt ?? null,
      },
    });

    const transaction =
      freshPayment.transactions.find((candidate) => candidate.type === "AUTHORIZATION") ?? freshPayment.transactions[0];
    if (transaction) {
      await tx.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          externalId: input.externalId,
          status: isFailed ? "FAILED" : isApproved ? "SUCCEEDED" : "PENDING",
          providerMetadata: input.result.providerMetadata as Prisma.InputJsonValue,
          processedAt: isApproved || isFailed ? new Date() : null,
        },
      });
    }

    if (isApproved) {
      await commitOrderReservations(tx, freshPayment.order.sellerOrders, freshPayment.order.id);
      await tx.order.update({ where: { id: freshPayment.order.id }, data: { status: "PAID" } });
      await tx.sellerOrder.updateMany({ where: { orderId: freshPayment.order.id }, data: { status: "PAID" } });
    }

    if (isFailed) {
      await releaseOrderReservations(
        tx,
        freshPayment.order.sellerOrders,
        freshPayment.order.id,
        "Payment failed or cancelled",
      );
      await tx.order.update({ where: { id: freshPayment.order.id }, data: { status: "CANCELLED" } });
      await tx.sellerOrder.updateMany({ where: { orderId: freshPayment.order.id }, data: { status: "CANCELLED" } });
      await tx.couponRedemption.deleteMany({ where: { orderId: freshPayment.order.id } });
    }

    if (input.webhookEventId) {
      await tx.webhookEvent.update({
        where: { id: input.webhookEventId },
        data: { status: "PROCESSED", processedAt: new Date(), error: null },
      });
    }
    return input.result.status;
  });

  if (persistedStatus === input.result.status && ["APPROVED", "FAILED", "CANCELLED"].includes(persistedStatus)) {
    await inngest.send({
      name: "motoshop/order.payment-status.changed",
      data: {
        orderNumber: payment.order.orderNumber,
        status: input.result.status,
        externalId: input.externalId,
      },
    });
  }

  return { orderNumber: payment.order.orderNumber, status: persistedStatus };
}

function readExternalReference(metadata: Record<string, unknown>): string | undefined {
  const value = metadata.external_reference;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
