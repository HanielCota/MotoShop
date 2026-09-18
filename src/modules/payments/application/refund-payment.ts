import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { mercadoPagoProvider } from "@/lib/payment/mercado-pago-provider";
import { assertMoneyInCents, sumMoneyInCents } from "@/modules/orders/domain/money";
import { ApplicationError } from "@/shared/errors/application-error";

export type RefundPaymentInput = {
  orderId: string;
  amountInCents: number;
  idempotencyKey: string;
  reason?: string;
};

export type RefundPaymentResult = {
  paymentId: string;
  transactionId: string;
  amountInCents: number;
  paymentStatus: "PARTIALLY_REFUNDED" | "REFUNDED";
};

export async function refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
  assertRefundInput(input);
  const existingTransaction = await db.paymentTransaction.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { payment: { select: { status: true } } },
  });
  if (existingTransaction) return buildExistingResult(existingTransaction);

  const payment = await findRefundablePayment(input.orderId);
  let reservation;
  try {
    reservation = await reserveRefundTransaction(payment.id, input);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrentTransaction = await db.paymentTransaction.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { payment: { select: { status: true } } },
      });
      if (concurrentTransaction) return buildExistingResult(concurrentTransaction);
    }
    throw error;
  }

  try {
    const providerResult = await mercadoPagoProvider.refund({
      externalId: reservation.payment.externalId as string,
      amountInCents: input.amountInCents,
      idempotencyKey: input.idempotencyKey,
    });
    const refundedAmountInCents = reservation.reservedRefundInCents + input.amountInCents;
    const paymentStatus =
      refundedAmountInCents === reservation.payment.amountInCents ? "REFUNDED" : "PARTIALLY_REFUNDED";
    await db.$transaction([
      db.paymentTransaction.update({
        where: { id: reservation.transaction.id },
        data: {
          status: "SUCCEEDED",
          externalId: providerResult.externalId,
          providerMetadata: providerResult.providerMetadata as Prisma.InputJsonValue,
          processedAt: new Date(),
        },
      }),
      db.payment.update({ where: { id: reservation.payment.id }, data: { status: paymentStatus } }),
    ]);
    return {
      paymentId: reservation.payment.id,
      transactionId: reservation.transaction.id,
      amountInCents: input.amountInCents,
      paymentStatus,
    };
  } catch (error) {
    await db.paymentTransaction.update({
      where: { id: reservation.transaction.id },
      data: { status: "FAILED", processedAt: new Date() },
    });
    throw error;
  }
}

async function reserveRefundTransaction(paymentId: string, input: RefundPaymentInput) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "payments" WHERE id = ${paymentId} FOR UPDATE`;
    const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { transactions: true } });
    if (!payment?.externalId) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "Este pedido não possui um pagamento reembolsável.",
        statusCode: 409,
      });
    }

    const reservedRefundInCents = sumMoneyInCents(
      payment.transactions
        .filter((transaction) => transaction.type === "REFUND" && transaction.status !== "FAILED")
        .map((transaction) => transaction.amountInCents),
    );
    const refundableAmountInCents = payment.amountInCents - reservedRefundInCents;
    if (input.amountInCents > refundableAmountInCents) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "O valor do reembolso excede o saldo disponível do pagamento.",
        statusCode: 409,
      });
    }

    const transaction = await tx.paymentTransaction.create({
      data: {
        type: "REFUND",
        status: "PENDING",
        amountInCents: input.amountInCents,
        idempotencyKey: input.idempotencyKey,
        paymentId: payment.id,
        ...(input.reason ? { providerMetadata: { reason: input.reason } } : {}),
      },
    });

    return { payment, transaction, reservedRefundInCents };
  });
}

async function findRefundablePayment(orderId: string) {
  const payment = await db.payment.findFirst({
    where: { orderId, provider: "MERCADO_PAGO", status: { in: ["APPROVED", "AUTHORIZED", "PARTIALLY_REFUNDED"] } },
    include: { transactions: true },
    orderBy: { createdAt: "desc" },
  });
  if (!payment?.externalId) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Este pedido não possui um pagamento reembolsável.",
      statusCode: 409,
    });
  }
  return payment;
}

function assertRefundInput(input: RefundPaymentInput): void {
  assertMoneyInCents(input.amountInCents, "amountInCents");
  if (!input.orderId || !input.idempotencyKey) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "Pedido e chave de idempotência são obrigatórios.",
    });
  }
}

function buildExistingResult(transaction: {
  id: string;
  paymentId: string;
  amountInCents: number;
  status: string;
  payment: { status: string };
}): RefundPaymentResult {
  if (transaction.status === "FAILED") {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "A tentativa de reembolso anterior falhou.",
      statusCode: 409,
    });
  }
  if (transaction.status !== "SUCCEEDED") {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Este reembolso já está sendo processado.",
      statusCode: 409,
    });
  }
  return {
    paymentId: transaction.paymentId,
    transactionId: transaction.id,
    amountInCents: transaction.amountInCents,
    paymentStatus: transaction.payment.status === "REFUNDED" ? "REFUNDED" : "PARTIALLY_REFUNDED",
  };
}
