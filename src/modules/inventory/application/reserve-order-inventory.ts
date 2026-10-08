import "server-only";

import { ApplicationError } from "@/shared/errors/application-error";
import type { InventoryTransaction } from "./settle-order-inventory";

export type InventoryReservationCharge = {
  sellerId: string;
  items: ReadonlyArray<{ variantId: string; quantity: number; variant: { inventory: { id: string } | null } }>;
};

/** Moves available stock to reserved for every item of one seller order, recording a movement per line. */
export async function reserveOrderInventory(
  tx: InventoryTransaction,
  charge: InventoryReservationCharge,
  orderId: string,
): Promise<void> {
  for (const item of charge.items) {
    const inventory = item.variant.inventory;
    if (!inventory)
      throw new ApplicationError({ code: "OUT_OF_STOCK", message: "Um produto ficou sem estoque.", statusCode: 409 });
    const updated = await tx.inventory.updateMany({
      where: { id: inventory.id, sellerId: charge.sellerId, availableQuantity: { gte: item.quantity } },
      data: {
        availableQuantity: { decrement: item.quantity },
        reservedQuantity: { increment: item.quantity },
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1)
      throw new ApplicationError({ code: "OUT_OF_STOCK", message: "Um produto ficou sem estoque.", statusCode: 409 });
    const after = await tx.inventory.findUniqueOrThrow({ where: { id: inventory.id } });
    await tx.inventoryMovement.create({
      data: {
        type: "RESERVATION",
        quantityChange: -item.quantity,
        availableQuantityAfter: after.availableQuantity,
        reservedQuantityAfter: after.reservedQuantity,
        referenceType: "ORDER",
        referenceId: orderId,
        reason: "Checkout reservation",
        inventoryId: inventory.id,
        variantId: item.variantId,
        sellerId: charge.sellerId,
      },
    });
  }
}
