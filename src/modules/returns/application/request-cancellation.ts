import "server-only";

import { type CancellationRequest, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { syncOrderStatusFromSellerOrders } from "@/modules/orders/application/sync-order-status";
import { ApplicationError } from "@/shared/errors/application-error";

import { isSellerOrderCancellable, isShipmentPosted } from "../domain/cancellation-eligibility";

export type CustomerCancellationIdentity = { userId: string } | { guestAccessTokenHash: string };

export type RequestCancellationInput = {
  orderNumber: string;
  sellerOrderId: string;
  reason: string;
  customerMessage?: string;
  idempotencyKey: string;
  identity: CustomerCancellationIdentity;
};

type AuthorizedSellerOrder = NonNullable<Awaited<ReturnType<typeof findAuthorizedSellerOrder>>>;

type LockedSellerOrder = NonNullable<Awaited<ReturnType<typeof findLockedSellerOrder>>>;

type CancellationRequestClient = Pick<Prisma.TransactionClient, "cancellationRequest">;

export async function requestCancellation(input: RequestCancellationInput) {
  const sellerOrder = await findAuthorizedSellerOrder(input);
  if (!sellerOrder) throw new ApplicationError({ code: "NOT_FOUND", message: "Pedido da loja não encontrado." });
  const existing = await findCancellationByIdempotencyKey(db, input.idempotencyKey);
  if (existing) return replayCancellation(existing, sellerOrder.id);
  assertCancellationAllowed(sellerOrder);

  const amountInCents = calculateCancellationAmountInCents(sellerOrder);
  try {
    return await db.$transaction(async (tx) => createCancellationWithLocks(tx, input, sellerOrder, amountInCents));
  } catch (error) {
    return recoverConcurrentCancellation(error, input.idempotencyKey, sellerOrder.id);
  }
}

async function findAuthorizedSellerOrder(input: RequestCancellationInput) {
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
    include: { shipment: true, cancellationRequests: true },
  });
}

async function findCancellationByIdempotencyKey(
  client: CancellationRequestClient,
  idempotencyKey: string,
): Promise<CancellationRequest | null> {
  return client.cancellationRequest.findUnique({ where: { idempotencyKey } });
}

function replayCancellation(request: CancellationRequest, sellerOrderId: string): CancellationRequest {
  assertTarget(request.sellerOrderId, sellerOrderId);
  return request;
}

async function recoverConcurrentCancellation(
  error: unknown,
  idempotencyKey: string,
  sellerOrderId: string,
): Promise<CancellationRequest> {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;

  const concurrent = await findCancellationByIdempotencyKey(db, idempotencyKey);
  if (!concurrent) throw error;
  return replayCancellation(concurrent, sellerOrderId);
}

function assertCancellationAllowed(sellerOrder: AuthorizedSellerOrder): void {
  if (!isSellerOrderCancellable(sellerOrder.status)) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Este pedido não está mais disponível para cancelamento. Se já foi enviado, solicite uma devolução.",
      statusCode: 409,
    });
  }
  if (isShipmentPosted(sellerOrder.shipment?.status)) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "O pedido já foi enviado. Solicite uma devolução após o recebimento.",
      statusCode: 409,
    });
  }
}

function calculateCancellationAmountInCents(sellerOrder: AuthorizedSellerOrder): number {
  return Math.max(
    0,
    sellerOrder.itemsSubtotalInCents - sellerOrder.discountAmountInCents + sellerOrder.customerShippingAmountInCents,
  );
}

async function createCancellationWithLocks(
  tx: Prisma.TransactionClient,
  input: RequestCancellationInput,
  sellerOrder: AuthorizedSellerOrder,
  amountInCents: number,
): Promise<CancellationRequest> {
  await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${sellerOrder.orderId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "seller_orders" WHERE id = ${sellerOrder.id} FOR UPDATE`;
  const replay = await findCancellationByIdempotencyKey(tx, input.idempotencyKey);
  if (replay) return replayCancellation(replay, sellerOrder.id);

  const locked = await findLockedSellerOrder(tx, sellerOrder.id);
  assertLockedSellerOrderCancellable(locked);
  await assertNoActiveReturns(tx, locked.id);

  const created = await tx.cancellationRequest.create({
    data: buildCancellationData(input, locked, amountInCents),
  });
  await markCancellationRequested(tx, locked, input.identity);
  return created;
}

async function findLockedSellerOrder(tx: Prisma.TransactionClient, sellerOrderId: string) {
  return tx.sellerOrder.findUnique({ where: { id: sellerOrderId }, include: { shipment: true } });
}

function assertLockedSellerOrderCancellable(locked: LockedSellerOrder | null): asserts locked is LockedSellerOrder {
  if (!locked || !isSellerOrderCancellable(locked.status)) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "O status do pedido mudou durante a solicitação.",
      statusCode: 409,
    });
  }
  if (isShipmentPosted(locked.shipment?.status)) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "O pedido já foi enviado. Solicite uma devolução após o recebimento.",
    });
  }
}

async function assertNoActiveReturns(tx: Prisma.TransactionClient, sellerOrderId: string): Promise<void> {
  const returns = await tx.returnRequest.count({
    where: { sellerOrderId, status: { not: "REJECTED" } },
  });
  if (returns === 0) return;

  throw new ApplicationError({
    code: "CONFLICT",
    message: "Este pedido possui devoluções. Conclua o atendimento pela devolução.",
  });
}

function buildCancellationData(
  input: RequestCancellationInput,
  locked: LockedSellerOrder,
  amountInCents: number,
): Prisma.CancellationRequestUncheckedCreateInput {
  return {
    status: "REQUESTED",
    reason: input.reason,
    amountInCents,
    ...(input.customerMessage ? { customerMessage: input.customerMessage } : {}),
    previousSellerOrderStatus: locked.status,
    idempotencyKey: input.idempotencyKey,
    orderId: locked.orderId,
    sellerOrderId: locked.id,
    sellerId: locked.sellerId,
    ...("userId" in input.identity ? { requesterUserId: input.identity.userId } : {}),
  };
}

async function markCancellationRequested(
  tx: Prisma.TransactionClient,
  locked: LockedSellerOrder,
  identity: CustomerCancellationIdentity,
): Promise<void> {
  await tx.sellerOrder.update({ where: { id: locked.id }, data: { status: "CANCELLATION_REQUESTED" } });
  await syncOrderStatusFromSellerOrders(
    tx,
    locked.orderId,
    "CANCELLATION",
    "userId" in identity ? identity.userId : undefined,
  );
}

function assertTarget(actual: string, expected: string) {
  if (actual !== expected)
    throw new ApplicationError({ code: "CONFLICT", message: "Esta chave de idempotência pertence a outro pedido." });
}
