import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { ApplicationError } from "@/shared/errors/application-error";

export const MAX_PENDING_ORDERS_PER_TAX_ID = 3;
const PENDING_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * M-06: each checkout reserves stock and may hold a coupon use until the payment resolves.
 * Changing cookies gave a fresh quota, so a CPF may have at most a few orders waiting for
 * payment at once; paying or the Pix expiring frees the slot.
 */
export async function assertPendingOrderCap(
  tx: Pick<Prisma.TransactionClient, "$queryRaw" | "order">,
  customerTaxId: string,
  now = new Date(),
): Promise<void> {
  // Serialize count + creation per CPF until the order transaction commits.
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`checkout:pending:${customerTaxId}`}, 0))`;
  const pending = await tx.order.count({
    where: {
      customerTaxId,
      status: "PENDING_PAYMENT",
      createdAt: { gt: new Date(now.getTime() - PENDING_WINDOW_MS) },
    },
  });
  if (pending < MAX_PENDING_ORDERS_PER_TAX_ID) return;

  throw new ApplicationError({
    code: "CONFLICT",
    statusCode: 409,
    message: "Você já tem pedidos aguardando pagamento. Pague um deles ou aguarde o vencimento antes de fazer outro.",
  });
}
