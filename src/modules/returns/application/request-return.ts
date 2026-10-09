import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { SellerOrderStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";
import type { CustomerOrderIdentity } from "@/modules/orders/application/resolve-customer-order-access";
import { ApplicationError } from "@/shared/errors/application-error";

import { isActiveReturnStatus, isSellerOrderEligibleForReturn } from "../domain/return-eligibility";

export type { CustomerOrderIdentity };

export type RequestReturnInput = {
  orderNumber: string;
  orderItemId: string;
  quantity: number;
  reason: string;
  customerMessage?: string;
  idempotencyKey: string;
  identity: CustomerOrderIdentity;
};

export type ReturnRequestResult = {
  id: string;
  orderNumber: string;
  orderItemId: string;
  quantity: number;
  status: string;
};

type AuthorizedOrderItem = NonNullable<Awaited<ReturnType<typeof findAuthorizedOrderItem>>>;

type ReturnRequestClient = Pick<Prisma.TransactionClient, "returnRequest">;

const returnRequestInclude = { items: true, order: true } satisfies Prisma.ReturnRequestInclude;

type ReturnRequestWithItems = Prisma.ReturnRequestGetPayload<{ include: typeof returnRequestInclude }>;

const lockedOrderItemInclude = {
  sellerOrder: { include: { order: true } },
  returnItems: { include: { returnRequest: true } },
} satisfies Prisma.OrderItemInclude;

type LockedOrderItem = Prisma.OrderItemGetPayload<{ include: typeof lockedOrderItemInclude }>;

type ActiveReturnSummary = { availableQuantity: number; requestedAmountInCents: number };

export async function requestReturn(input: RequestReturnInput): Promise<ReturnRequestResult> {
  assertInput(input);
  const orderItem = await findAuthorizedOrderItem(input);
  if (!orderItem)
    throw new ApplicationError({ code: "NOT_FOUND", message: "Item do pedido não encontrado.", statusCode: 404 });
  assertDeliveredBeforeReturn(orderItem.sellerOrder.status);

  const existingRequest = await findReturnRequestByIdempotencyKey(db, input.idempotencyKey);
  if (existingRequest) return replayReturnRequest(existingRequest, orderItem, input);

  try {
    return await db.$transaction(async (tx) => createReturnRequestWithLocks(tx, input, orderItem));
  } catch (error) {
    return recoverConcurrentReturnRequest(error, orderItem, input);
  }
}

function assertDeliveredBeforeReturn(sellerOrderStatus: SellerOrderStatus): void {
  if (isSellerOrderEligibleForReturn(sellerOrderStatus)) return;

  throw new ApplicationError({
    code: "CONFLICT",
    message: "A devolução fica disponível após a entrega. Antes disso, solicite o cancelamento.",
    statusCode: 409,
  });
}

async function findReturnRequestByIdempotencyKey(
  client: ReturnRequestClient,
  idempotencyKey: string,
): Promise<ReturnRequestWithItems | null> {
  return client.returnRequest.findUnique({ where: { idempotencyKey }, include: returnRequestInclude });
}

function replayReturnRequest(
  request: ReturnRequestWithItems,
  orderItem: AuthorizedOrderItem,
  input: RequestReturnInput,
): ReturnRequestResult {
  assertSameRequestTarget(request, orderItem.sellerOrder.orderId, input.orderItemId);
  return toResult(request, input.orderItemId);
}

async function recoverConcurrentReturnRequest(
  error: unknown,
  orderItem: AuthorizedOrderItem,
  input: RequestReturnInput,
): Promise<ReturnRequestResult> {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;

  const concurrentRequest = await findReturnRequestByIdempotencyKey(db, input.idempotencyKey);
  if (!concurrentRequest) throw error;
  return replayReturnRequest(concurrentRequest, orderItem, input);
}

async function createReturnRequestWithLocks(
  tx: Prisma.TransactionClient,
  input: RequestReturnInput,
  orderItem: AuthorizedOrderItem,
): Promise<ReturnRequestResult> {
  await lockReturnTargets(tx, orderItem);
  const replay = await findReturnRequestByIdempotencyKey(tx, input.idempotencyKey);
  if (replay) return replayReturnRequest(replay, orderItem, input);

  const lockedItem = await findLockedOrderItem(tx, orderItem.id);
  await assertSellerOrderTotalsMatchItems(tx, lockedItem);
  const activeReturns = summarizeActiveReturns(lockedItem);
  assertQuantityAvailable(input.quantity, activeReturns.availableQuantity);

  const created = await tx.returnRequest.create({
    data: buildReturnRequestData(input, lockedItem, activeReturns),
    include: returnRequestInclude,
  });
  return toResult(created, lockedItem.id);
}

async function lockReturnTargets(tx: Prisma.TransactionClient, orderItem: AuthorizedOrderItem): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderItem.sellerOrder.orderId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "seller_orders" WHERE id = ${orderItem.sellerOrderId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "order_items" WHERE id = ${orderItem.id} FOR UPDATE`;
}

async function findLockedOrderItem(tx: Prisma.TransactionClient, orderItemId: string): Promise<LockedOrderItem> {
  const lockedItem = await tx.orderItem.findUnique({ where: { id: orderItemId }, include: lockedOrderItemInclude });
  if (!lockedItem) throw new ApplicationError({ code: "NOT_FOUND", message: "Item do pedido não encontrado." });
  if (!isSellerOrderEligibleForReturn(lockedItem.sellerOrder.status)) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "O status do pedido mudou durante a solicitação.",
      statusCode: 409,
    });
  }

  return lockedItem;
}

async function assertSellerOrderTotalsMatchItems(
  tx: Prisma.TransactionClient,
  lockedItem: LockedOrderItem,
): Promise<void> {
  const itemTotals = await tx.orderItem.aggregate({
    where: { sellerOrderId: lockedItem.sellerOrderId },
    _sum: { totalAmountInCents: true },
  });
  const expectedItemsTotal = lockedItem.sellerOrder.itemsSubtotalInCents - lockedItem.sellerOrder.discountAmountInCents;
  if (itemTotals._sum.totalAmountInCents === expectedItemsTotal) return;

  throw new ApplicationError({
    code: "CONFLICT",
    message: "Os valores deste pedido precisam de revisão pelo Moto Shop antes da devolução.",
  });
}

function summarizeActiveReturns(lockedItem: LockedOrderItem): ActiveReturnSummary {
  const activeReturnItems = lockedItem.returnItems.filter((item) => isActiveReturnStatus(item.returnRequest.status));
  const requestedQuantity = activeReturnItems.reduce((total, item) => total + item.quantity, 0);
  const requestedAmountInCents = activeReturnItems.reduce((total, item) => total + item.returnRequest.amountInCents, 0);

  return { availableQuantity: lockedItem.quantity - requestedQuantity, requestedAmountInCents };
}

function assertQuantityAvailable(quantity: number, availableQuantity: number): void {
  if (quantity <= availableQuantity) return;

  throw new ApplicationError({
    code: "CONFLICT",
    message: "A quantidade solicitada já possui devoluções em andamento.",
    statusCode: 409,
  });
}

function calculateReturnAmountInCents(
  lockedItem: LockedOrderItem,
  quantity: number,
  activeReturns: ActiveReturnSummary,
): number {
  // O último lote absorve o resto do arredondamento para que a soma das devoluções feche o total do item.
  if (quantity === activeReturns.availableQuantity) {
    return lockedItem.totalAmountInCents - activeReturns.requestedAmountInCents;
  }

  return Math.floor((lockedItem.totalAmountInCents * quantity) / lockedItem.quantity);
}

function buildReturnRequestData(
  input: RequestReturnInput,
  lockedItem: LockedOrderItem,
  activeReturns: ActiveReturnSummary,
): Prisma.ReturnRequestUncheckedCreateInput {
  return {
    status: "REQUESTED",
    reason: input.reason,
    amountInCents: calculateReturnAmountInCents(lockedItem, input.quantity, activeReturns),
    ...(input.customerMessage ? { customerMessage: input.customerMessage } : {}),
    idempotencyKey: input.idempotencyKey,
    orderId: lockedItem.sellerOrder.orderId,
    sellerOrderId: lockedItem.sellerOrderId,
    sellerId: lockedItem.sellerId,
    ...("userId" in input.identity ? { requesterUserId: input.identity.userId } : {}),
    items: {
      create: {
        quantity: input.quantity,
        orderItemId: lockedItem.id,
        sellerOrderId: lockedItem.sellerOrderId,
        sellerId: lockedItem.sellerId,
      },
    },
  };
}

function assertSameRequestTarget(
  request: { orderId: string; items: Array<{ orderItemId: string }> },
  orderId: string,
  orderItemId: string,
): void {
  if (request.orderId !== orderId || !request.items.some((item) => item.orderItemId === orderItemId)) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "A chave de idempotência já foi utilizada em outra solicitação.",
      statusCode: 409,
    });
  }
}

async function findAuthorizedOrderItem(input: RequestReturnInput) {
  return db.orderItem.findFirst({
    where: {
      id: input.orderItemId,
      sellerOrder: {
        order: {
          orderNumber: input.orderNumber,
          ...("userId" in input.identity
            ? { userId: input.identity.userId }
            : { guestAccessTokenHash: input.identity.guestAccessTokenHash }),
        },
      },
    },
    include: { sellerOrder: true },
  });
}

function assertInput(input: RequestReturnInput): void {
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
    throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Informe uma quantidade válida." });
  }
  if (!input.orderNumber || !input.orderItemId || !input.idempotencyKey || !input.reason) {
    throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Preencha os dados da devolução." });
  }
}

function toResult(
  request: {
    id: string;
    status: string;
    order: { orderNumber: string };
    items: Array<{ orderItemId: string; quantity: number }>;
  },
  orderItemId: string,
): ReturnRequestResult {
  const item = request.items.find((candidate) => candidate.orderItemId === orderItemId);
  if (!item) throw new ApplicationError({ code: "CONFLICT", message: "A devolução não contém o item solicitado." });
  return {
    id: request.id,
    orderNumber: request.order.orderNumber,
    orderItemId,
    quantity: item.quantity,
    status: request.status,
  };
}
