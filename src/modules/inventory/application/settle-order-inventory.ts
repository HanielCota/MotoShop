import "server-only";

import { db } from "@/lib/database";
import { ApplicationError } from "@/shared/errors/application-error";

export type InventoryTransaction = Parameters<Parameters<typeof db.$transaction>[0]>[0];
export type ReservedSellerOrder = {
  sellerId: string;
  items: Array<{ variantId: string | null; quantity: number }>;
};

export async function commitOrderReservations(
  tx: InventoryTransaction,
  sellerOrders: ReservedSellerOrder[],
  referenceId: string,
): Promise<void> {
  await settleReservedInventory(tx, sellerOrders, referenceId, "SALE", "Payment approved", false);
}

export async function releaseOrderReservations(
  tx: InventoryTransaction,
  sellerOrders: ReservedSellerOrder[],
  referenceId: string,
  reason: string,
): Promise<void> {
  await settleReservedInventory(tx, sellerOrders, referenceId, "RESERVATION_RELEASE", reason, true);
}

/** Origem que justifica a devolução de estoque já baixado (rastreabilidade do movimento). */
export type CommittedInventoryCancellationReference = {
  referenceType: "CANCELLATION_REQUEST" | "SELLER_ORDER";
  referenceId: string;
  actorUserId: string | null;
};

export async function cancelCommittedInventory(
  tx: InventoryTransaction,
  sellerOrders: ReservedSellerOrder[],
  reference: CommittedInventoryCancellationReference,
): Promise<void> {
  for (const sellerOrder of sellerOrders) {
    for (const item of sellerOrder.items) {
      if (!item.variantId) continue;
      const inventory = await tx.inventory.findUnique({ where: { variantId: item.variantId } });
      if (!inventory) throw new ApplicationError({ code: "NOT_FOUND", message: "Estoque da variante não encontrado." });
      const updated = await tx.inventory.updateMany({
        where: { id: inventory.id, sellerId: sellerOrder.sellerId },
        data: { availableQuantity: { increment: item.quantity }, version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new ApplicationError({
          code: "CONFLICT",
          message: "O estoque não pôde ser restaurado para o cancelamento.",
        });
      }
      const after = await tx.inventory.findUniqueOrThrow({ where: { id: inventory.id } });
      await tx.inventoryMovement.create({
        data: {
          type: "CANCELLATION",
          quantityChange: item.quantity,
          availableQuantityAfter: after.availableQuantity,
          reservedQuantityAfter: after.reservedQuantity,
          referenceType: reference.referenceType,
          referenceId: reference.referenceId,
          actorUserId: reference.actorUserId,
          reason: "Seller order cancelled",
          inventoryId: inventory.id,
          variantId: item.variantId,
          sellerId: sellerOrder.sellerId,
        },
      });
    }
  }
}

async function settleReservedInventory(
  tx: InventoryTransaction,
  sellerOrders: ReservedSellerOrder[],
  referenceId: string,
  movementType: "SALE" | "RESERVATION_RELEASE",
  reason: string,
  returnToAvailable: boolean,
): Promise<void> {
  for (const sellerOrder of sellerOrders) {
    for (const item of sellerOrder.items) {
      if (!item.variantId) continue;
      const inventory = await tx.inventory.findUnique({ where: { variantId: item.variantId } });
      if (!inventory) throw new ApplicationError({ code: "NOT_FOUND", message: "Estoque da variante não encontrado." });
      const updated = await tx.inventory.updateMany({
        where: { id: inventory.id, sellerId: sellerOrder.sellerId, reservedQuantity: { gte: item.quantity } },
        data: {
          ...(returnToAvailable ? { availableQuantity: { increment: item.quantity } } : {}),
          reservedQuantity: { decrement: item.quantity },
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ApplicationError({ code: "CONFLICT", message: "A reserva de estoque não pôde ser atualizada." });
      }
      const after = await tx.inventory.findUniqueOrThrow({ where: { id: inventory.id } });
      await tx.inventoryMovement.create({
        data: {
          type: movementType,
          quantityChange: returnToAvailable ? item.quantity : -item.quantity,
          availableQuantityAfter: after.availableQuantity,
          reservedQuantityAfter: after.reservedQuantity,
          referenceType: "ORDER",
          referenceId,
          reason,
          inventoryId: inventory.id,
          variantId: item.variantId,
          sellerId: sellerOrder.sellerId,
        },
      });
    }
  }
}
