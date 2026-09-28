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
    include: { payment: { select: { status: true, orderId: true } } },
  });
  if (existingTransaction) return buildExistingResult(existingTransaction, input);

  const payment = await findRefundablePayment(input.orderId);
  let reservation;
  try {
    reservation = await reserveRefundTransaction(payment.id, input);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrentTransaction = await db.paymentTransaction.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { payment: { select: { status: true, orderId: true } } },
      });
      if (concurrentTransaction) return buildExistingResult(concurrentTransaction, input);
    }
    throw error;
  }

  // An exception can occur after the provider accepted the refund. Keep the
  // reservation pending until its outcome is known; never free money on timeout.
  const providerResult = await mercadoPagoProvider.refund({
    externalId: reservation.externalId,
    amountInCents: input.amountInCents,
    idempotencyKey: input.idempotencyKey,
  });
  if (providerResult.status !== "APPROVED") {
    if (["FAILED", "CANCELLED"].includes(providerResult.status)) {
      await db.paymentTransaction.update({
        where: { id: reservation.transaction.id },
        data: { status: "FAILED", processedAt: new Date() },
      });
    }
    throw new ApplicationError({ code: "CONFLICT", message: "O reembolso ainda não foi confirmado pelo provedor." });
  }
  const paymentStatus = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "payments" WHERE id = ${reservation.payment.id} FOR UPDATE`;
    const completed = await tx.paymentTransaction.findMany({
      where: { paymentId: reservation.payment.id, type: "REFUND", status: "SUCCEEDED" },
      select: { amountInCents: true },
    });
    const refundedAmountInCents = sumMoneyInCents([
      ...completed.map((entry) => entry.amountInCents),
      input.amountInCents,
    ]);
    const paymentStatus =
      refundedAmountInCents === reservation.payment.amountInCents ? "REFUNDED" : "PARTIALLY_REFUNDED";
    await tx.paymentTransaction.update({
      where: { id: reservation.transaction.id },
      data: {
        status: "SUCCEEDED",
        externalId: providerResult.externalId,
        providerMetadata: providerResult.providerMetadata as Prisma.InputJsonValue,
        processedAt: new Date(),
      },
    });
    await tx.payment.update({ where: { id: reservation.payment.id }, data: { status: paymentStatus } });
    return paymentStatus;
  });
  return {
    paymentId: reservation.payment.id,
    transactionId: reservation.transaction.id,
    amountInCents: input.amountInCents,
    paymentStatus,
  };
}

async function reserveRefundTransaction(paymentId: string, input: RefundPaymentInput) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "payments" WHERE id = ${paymentId} FOR UPDATE`;
    const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { transactions: true } });
    if (!payment?.externalId || !["APPROVED", "PARTIALLY_REFUNDED"].includes(payment.status)) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "Este pedido não possui um pagamento reembolsável.",
        statusCode: 409,
      });
    }
    if (payment.transactions.some((entry) => entry.type === "REFUND" && entry.status === "PENDING")) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "Há um reembolso pendente de confirmação para este pagamento.",
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

    return { payment, transaction, externalId: payment.externalId };
  });
}

async function findRefundablePayment(orderId: string) {
  const payment = await db.payment.findFirst({
    where: { orderId, provider: "MERCADO_PAGO", status: { in: ["APPROVED", "PARTIALLY_REFUNDED"] } },
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
  if (input.amountInCents === 0 || !input.orderId || !input.idempotencyKey) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "Informe pedido, chave de idempotência e valor positivo de reembolso.",
    });
  }
}

function buildExistingResult(
  transaction: {
    id: string;
    paymentId: string;
    amountInCents: number;
    status: string;
    type: string;
    payment: { status: string; orderId: string };
  },
  input: RefundPaymentInput,
): RefundPaymentResult {
  if (
    transaction.type !== "REFUND" ||
    transaction.payment.orderId !== input.orderId ||
    transaction.amountInCents !== input.amountInCents
  ) {
    throw new ApplicationError({ code: "CONFLICT", message: "Esta chave de idempotência pertence a outra operação." });
  }
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
