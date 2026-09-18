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
}): Promise<{ orderNumber: string; status: GetPaymentResult["status"] }> {
  const externalReference = readExternalReference(input.result.providerMetadata);
  const payment = await db.payment.findFirst({
    where: {
      provider: "MERCADO_PAGO",
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

  await db.$transaction(async (tx) => {
    const freshPayment = await tx.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: { order: { include: { sellerOrders: { include: { items: true } } } }, transactions: true },
    });
    const isApproved = input.result.status === "APPROVED" || input.result.status === "AUTHORIZED";
    const isFailed = input.result.status === "FAILED" || input.result.status === "CANCELLED";

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

    if (isApproved && freshPayment.order.status !== "PAID") {
      await commitOrderReservations(tx, freshPayment.order.sellerOrders, freshPayment.order.id);
      await tx.order.update({ where: { id: freshPayment.order.id }, data: { status: "PAID" } });
      await tx.sellerOrder.updateMany({ where: { orderId: freshPayment.order.id }, data: { status: "PAID" } });
    }

    if (isFailed && freshPayment.order.status !== "CANCELLED") {
      await releaseOrderReservations(
        tx,
        freshPayment.order.sellerOrders,
        freshPayment.order.id,
        "Payment failed or cancelled",
      );
      await tx.order.update({ where: { id: freshPayment.order.id }, data: { status: "CANCELLED" } });
      await tx.sellerOrder.updateMany({ where: { orderId: freshPayment.order.id }, data: { status: "CANCELLED" } });
    }

    if (input.webhookEventId) {
      await tx.webhookEvent.update({
        where: { id: input.webhookEventId },
      data: { status: "PROCESSED", processedAt: new Date(), error: null },
      });
    }
  });

  if (["APPROVED", "AUTHORIZED", "FAILED", "CANCELLED"].includes(input.result.status)) {
    await inngest.send({
      name: "motoshop/order.payment-status.changed",
      data: {
        orderNumber: payment.order.orderNumber,
        status: input.result.status,
        externalId: input.externalId,
      },
    });
  }

  return { orderNumber: payment.order.orderNumber, status: input.result.status };
}

function readExternalReference(metadata: Record<string, unknown>): string | undefined {
  const value = metadata.external_reference;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
