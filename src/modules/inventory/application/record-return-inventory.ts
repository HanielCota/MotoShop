import { ApplicationError } from "@/shared/errors/application-error";

import type { InventoryTransaction } from "./settle-order-inventory";

export async function recordReturnedInventory(
  tx: InventoryTransaction,
  items: Array<{ variantId: string | null; sellerId: string; quantity: number }>,
  referenceId: string,
  actorUserId: string,
): Promise<void> {
  for (const item of items) {
    if (!item.variantId) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "O item devolvido não possui uma variante de estoque válida.",
        statusCode: 409,
      });
    }
    const inventory = await tx.inventory.findFirst({
      where: { variantId: item.variantId, sellerId: item.sellerId },
    });
    if (!inventory) {
      throw new ApplicationError({
        code: "NOT_FOUND",
        message: "Estoque da variante devolvida não foi encontrado.",
        statusCode: 404,
      });
    }

    const updated = await tx.inventory.updateMany({
      where: { id: inventory.id, sellerId: item.sellerId },
      data: { availableQuantity: { increment: item.quantity }, version: { increment: 1 } },
    });
    if (updated.count !== 1) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "O estoque mudou durante o recebimento da devolução. Tente novamente.",
        statusCode: 409,
      });
    }

    const after = await tx.inventory.findUniqueOrThrow({ where: { id: inventory.id } });
    await tx.inventoryMovement.create({
      data: {
        type: "RETURN",
        quantityChange: item.quantity,
        availableQuantityAfter: after.availableQuantity,
        reservedQuantityAfter: after.reservedQuantity,
        referenceType: "RETURN_REQUEST",
        referenceId,
        reason: "Item devolvido recebido pelo MotoShop",
        inventoryId: inventory.id,
        variantId: item.variantId,
        sellerId: item.sellerId,
        actorUserId,
      },
    });
  }
}
