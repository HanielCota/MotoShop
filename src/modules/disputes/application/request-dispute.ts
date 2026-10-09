import "server-only";

import { type Dispute, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { ApplicationError } from "@/shared/errors/application-error";

import { isSellerOrderEligibleForDispute } from "../domain/dispute-eligibility";

export type DisputeIdentity = { userId: string } | { guestAccessTokenHash: string };

export type RequestDisputeInput = {
  orderNumber: string;
  sellerOrderId: string;
  reason: string;
  description: string;
  idempotencyKey: string;
  identity: DisputeIdentity;
};

type AuthorizedSellerOrder = NonNullable<Awaited<ReturnType<typeof findAuthorizedSellerOrder>>>;

type DisputeClient = Pick<Prisma.TransactionClient, "dispute">;

export async function requestDispute(input: RequestDisputeInput) {
  const sellerOrder = await findAuthorizedSellerOrder(input);
  if (!sellerOrder) throw new ApplicationError({ code: "NOT_FOUND", message: "Pedido da loja não encontrado." });
  const existing = await findDisputeByIdempotencyKey(db, input.idempotencyKey);
  if (existing) return replayDispute(existing, sellerOrder.id);
  assertDisputeAllowed(sellerOrder);

  try {
    return await db.$transaction(async (tx) => createDisputeWithLocks(tx, input, sellerOrder));
  } catch (error) {
    return recoverConcurrentDispute(error, input.idempotencyKey, sellerOrder.id);
  }
}

async function findAuthorizedSellerOrder(input: RequestDisputeInput) {
  return db.sellerOrder.findFirst({
    where: {
      id: input.sellerOrderId,
      order: {
        orderNumber: input.orderNumber,
        ...("userId" in input.identity
          ? { userId: input.identity.userId }
          : { guestAccessTokenHash: input.identity.guestAccessTokenHash }),
      },
    },
    include: { disputes: { where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } } },
  });
}

async function findDisputeByIdempotencyKey(client: DisputeClient, idempotencyKey: string): Promise<Dispute | null> {
  return client.dispute.findUnique({ where: { idempotencyKey } });
}

function replayDispute(dispute: Dispute, sellerOrderId: string): Dispute {
  assertTarget(dispute.sellerOrderId, sellerOrderId);
  return dispute;
}

async function recoverConcurrentDispute(error: unknown, idempotencyKey: string, sellerOrderId: string) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;

  const concurrent = await findDisputeByIdempotencyKey(db, idempotencyKey);
  if (!concurrent) throw error;
  return replayDispute(concurrent, sellerOrderId);
}

function assertDisputeAllowed(sellerOrder: AuthorizedSellerOrder): void {
  if (!isSellerOrderEligibleForDispute(sellerOrder.status)) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Este pedido não está disponível para abrir uma disputa.",
      statusCode: 409,
    });
  }
  if (sellerOrder.disputes.length > 0) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Já existe uma disputa aberta para este pedido.",
      statusCode: 409,
    });
  }
}

async function createDisputeWithLocks(
  tx: Prisma.TransactionClient,
  input: RequestDisputeInput,
  sellerOrder: AuthorizedSellerOrder,
): Promise<Dispute> {
  await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${sellerOrder.orderId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "seller_orders" WHERE id = ${sellerOrder.id} FOR UPDATE`;
  const replay = await findDisputeByIdempotencyKey(tx, input.idempotencyKey);
  if (replay) return replayDispute(replay, sellerOrder.id);

  await assertLockedSellerOrderEligible(tx, sellerOrder.id);
  await assertNoActiveDispute(tx, sellerOrder.id);
  return tx.dispute.create({ data: buildDisputeData(input, sellerOrder) });
}

async function assertLockedSellerOrderEligible(tx: Prisma.TransactionClient, sellerOrderId: string): Promise<void> {
  const current = await tx.sellerOrder.findUnique({ where: { id: sellerOrderId }, select: { status: true } });
  if (current && isSellerOrderEligibleForDispute(current.status)) return;

  throw new ApplicationError({ code: "CONFLICT", message: "O status do pedido mudou durante a solicitação." });
}

async function assertNoActiveDispute(tx: Prisma.TransactionClient, sellerOrderId: string): Promise<void> {
  const active = await tx.dispute.count({
    where: { sellerOrderId, status: { in: ["OPEN", "UNDER_REVIEW"] } },
  });
  if (active > 0)
    throw new ApplicationError({ code: "CONFLICT", message: "Já existe uma disputa aberta para este pedido." });
}

function buildDisputeData(
  input: RequestDisputeInput,
  sellerOrder: AuthorizedSellerOrder,
): Prisma.DisputeUncheckedCreateInput {
  return {
    status: "OPEN",
    reason: input.reason,
    description: input.description,
    idempotencyKey: input.idempotencyKey,
    orderId: sellerOrder.orderId,
    sellerOrderId: sellerOrder.id,
    sellerId: sellerOrder.sellerId,
    ...("userId" in input.identity ? { requesterUserId: input.identity.userId } : {}),
  };
}

function assertTarget(actual: string, expected: string) {
  if (actual !== expected)
    throw new ApplicationError({ code: "CONFLICT", message: "Esta chave de idempotência pertence a outro pedido." });
}
