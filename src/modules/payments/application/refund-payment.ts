import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { mercadoPagoProvider } from "@/lib/payment/mercado-pago-provider";
import { assertMoneyInCents, sumMoneyInCents } from "@/modules/orders/domain/money";
import { ApplicationError } from "@/shared/errors/application-error";
import { PaymentProviderError } from "@/shared/payment/payment-provider-error";

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
    include: { payment: { select: { status: true, orderId: true, amountInCents: true, externalId: true } } },
  });
  if (existingTransaction) {
    assertSameRefundOperation(existingTransaction, input);
    if (existingTransaction.status === "PENDING") {
      // A previous attempt reserved this refund but its provider outcome is unknown
      // (timeout, crash, in_process). Ask the provider again with the SAME idempotency
      // key: the gateway returns the original refund instead of creating a second one.
      const externalId = existingTransaction.payment.externalId;
      if (!externalId) {
        throw new ApplicationError({
          code: "CONFLICT",
          message: "Este pedido não possui um pagamento reembolsável.",
          statusCode: 409,
        });
      }
      return requestAndSettleRefund(
        {
          paymentId: existingTransaction.paymentId,
          paymentAmountInCents: existingTransaction.payment.amountInCents,
          transactionId: existingTransaction.id,
          externalId,
        },
        input,
      );
    }
    return buildExistingResult(existingTransaction, input);
  }

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
      if (concurrentTransaction) {
        assertSameRefundOperation(concurrentTransaction, input);
        return buildExistingResult(concurrentTransaction, input);
      }
    }
    throw error;
  }

  return requestAndSettleRefund(
    {
      paymentId: reservation.payment.id,
      paymentAmountInCents: reservation.payment.amountInCents,
      transactionId: reservation.transaction.id,
      externalId: reservation.externalId,
    },
    input,
  );
}

type RefundReservation = {
  paymentId: string;
  paymentAmountInCents: number;
  transactionId: string;
  externalId: string;
};

async function requestAndSettleRefund(
  reservation: RefundReservation,
  input: RefundPaymentInput,
): Promise<RefundPaymentResult> {
  let providerResult;
  try {
    providerResult = await mercadoPagoProvider.refund({
      externalId: reservation.externalId,
      amountInCents: input.amountInCents,
      idempotencyKey: input.idempotencyKey,
    });
  } catch (error) {
    // A definitive rejection (400/401/403/422/429) means the provider did not accept the
    // refund, so the reservation can be released. Any other exception can happen AFTER
    // the provider accepted it: keep the reservation pending (a retry with the same key
    // resolves it); never free money on timeout.
    if (error instanceof PaymentProviderError && error.details.outcome === "DEFINITIVE_REJECTION") {
      await markRefundFailed(reservation.transactionId);
    }
    throw error;
  }

  if (providerResult.status !== "APPROVED") {
    if (["FAILED", "CANCELLED"].includes(providerResult.status)) {
      await markRefundFailed(reservation.transactionId);
      throw new ApplicationError({ code: "CONFLICT", message: "O provedor recusou o reembolso.", statusCode: 409 });
    }
    throw new ApplicationError({ code: "CONFLICT", message: "O reembolso ainda não foi confirmado pelo provedor." });
  }

  // The provider reports the refunded value in reais. A mismatch means money moved differently from what was
  // requested: keep the transaction PENDING (never mark it SUCCEEDED or FAILED) so a human reviews it.
  const refundedAmount = providerResult.providerMetadata?.amount;
  if (typeof refundedAmount === "number" && Math.round(refundedAmount * 100) !== input.amountInCents) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "O valor reembolsado pelo provedor difere do solicitado. O reembolso precisa de revisão financeira.",
      statusCode: 409,
    });
  }

  const paymentStatus = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "payments" WHERE id = ${reservation.paymentId} FOR UPDATE`;
    const completed = await tx.paymentTransaction.findMany({
      where: {
        paymentId: reservation.paymentId,
        type: "REFUND",
        status: "SUCCEEDED",
        id: { not: reservation.transactionId },
      },
      select: { amountInCents: true },
    });
    const refundedAmountInCents = sumMoneyInCents([
      ...completed.map((entry) => entry.amountInCents),
      input.amountInCents,
    ]);
    const paymentStatus =
      refundedAmountInCents === reservation.paymentAmountInCents ? "REFUNDED" : "PARTIALLY_REFUNDED";
    await tx.paymentTransaction.update({
      where: { id: reservation.transactionId },
      data: {
        status: "SUCCEEDED",
        externalId: providerResult.externalId,
        providerMetadata: providerResult.providerMetadata as Prisma.InputJsonValue,
        processedAt: new Date(),
      },
    });
    await tx.payment.update({ where: { id: reservation.paymentId }, data: { status: paymentStatus } });
    return paymentStatus;
  });
  return {
    paymentId: reservation.paymentId,
    transactionId: reservation.transactionId,
    amountInCents: input.amountInCents,
    paymentStatus,
  };
}

async function markRefundFailed(transactionId: string): Promise<void> {
  // Only a still-pending reservation can fail; a concurrent success must never be overwritten.
  await db.paymentTransaction.updateMany({
    where: { id: transactionId, status: "PENDING" },
    data: { status: "FAILED", processedAt: new Date() },
  });
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

function assertSameRefundOperation(
  transaction: { type: string; amountInCents: number; payment: { orderId: string } },
  input: RefundPaymentInput,
): void {
  if (
    transaction.type !== "REFUND" ||
    transaction.payment.orderId !== input.orderId ||
    transaction.amountInCents !== input.amountInCents
  ) {
    throw new ApplicationError({ code: "CONFLICT", message: "Esta chave de idempotência pertence a outra operação." });
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
  assertSameRefundOperation(transaction, input);
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
