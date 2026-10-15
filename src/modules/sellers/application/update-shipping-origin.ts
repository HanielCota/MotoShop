import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { db } from "@/lib/database";
import { ApplicationError } from "@/shared/errors/application-error";

import type { ShippingOriginInput } from "../schemas/shipping-origin";

type ShippingOriginScope = { storeId: string; sellerId: string; actorUserId: string };

const shippingOriginAuditSelect = {
  originName: true,
  originEmail: true,
  originPhone: true,
  originDocument: true,
  originPostalCode: true,
  originStreet: true,
  originNumber: true,
  originComplement: true,
  originNeighborhood: true,
  originCity: true,
  originState: true,
  originStateRegister: true,
} as const;

type ShippingOriginSnapshot = { [K in keyof typeof shippingOriginAuditSelect]: string | null };

/** Updates the store's shipping origin within the seller's tenant and audits it with the document masked. */
export async function updateShippingOrigin(scope: ShippingOriginScope, input: ShippingOriginInput): Promise<void> {
  const data = toShippingOriginData(input);

  await db.$transaction(async (tx) => {
    const previous = await tx.store.findFirst({
      where: { id: scope.storeId, sellerId: scope.sellerId },
      select: shippingOriginAuditSelect,
    });
    if (!previous) throw new ApplicationError({ code: "NOT_FOUND", message: "Loja não encontrada." });

    await tx.store.update({ where: { id: scope.storeId, sellerId: scope.sellerId }, data });
    await recordShippingOriginAudit(tx, scope, { previous, next: data });
  });
}

function toShippingOriginData(input: ShippingOriginInput) {
  return {
    originName: input.originName,
    originEmail: input.originEmail,
    originPhone: input.originPhone,
    originDocument: input.originDocument,
    originPostalCode: input.originPostalCode,
    originStreet: input.originStreet,
    originNumber: input.originNumber,
    originComplement: input.originComplement ?? null,
    originNeighborhood: input.originNeighborhood,
    originCity: input.originCity,
    originState: input.originState,
    originStateRegister: input.originStateRegister ?? null,
  };
}

async function recordShippingOriginAudit(
  tx: Prisma.TransactionClient,
  scope: ShippingOriginScope,
  change: { previous: ShippingOriginSnapshot; next: ShippingOriginSnapshot },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      action: "STORE_SHIPPING_ORIGIN_UPDATED",
      entityType: "STORE",
      entityId: scope.storeId,
      actorUserId: scope.actorUserId,
      metadata: {
        sellerId: scope.sellerId,
        previous: maskShippingOrigin(change.previous),
        next: maskShippingOrigin(change.next),
      },
    },
  });
}

// CPF/CNPJ never reaches the audit log in clear text; the last two digits are
// enough to show that the document changed.
function maskShippingOrigin(origin: ShippingOriginSnapshot): ShippingOriginSnapshot {
  const digits = origin.originDocument?.replace(/\D/g, "") ?? "";
  return {
    ...origin,
    originDocument: digits ? `${"*".repeat(Math.max(0, digits.length - 2))}${digits.slice(-2)}` : null,
  };
}
