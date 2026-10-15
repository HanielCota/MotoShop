import "server-only";

import { ProductStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";
import { ApplicationError } from "@/shared/errors/application-error";

import { adjustAvailableInventory } from "../domain/inventory-balance";
import {
  getManualAdjustmentChange,
  getManualAdjustmentReason,
  manualAdjustmentMovementTypes,
  validateManualAdjustment,
  type ManualAdjustment,
} from "../domain/manual-adjustment";

type ManualAdjustmentInput = {
  sellerId: string;
  actorUserId: string;
  variantId: string;
  adjustment: ManualAdjustment;
};

/**
 * Ajuste manual de estoque feito pelo lojista. Bloqueia a linha de estoque
 * (`FOR UPDATE`) antes de ler o saldo e registra a movimentação auditável.
 */
export async function adjustInventoryManually(input: ManualAdjustmentInput) {
  const { sellerId, actorUserId, variantId, adjustment } = input;
  const validationError = validateManualAdjustment(adjustment);
  if (validationError) {
    throw new ApplicationError({ code: "VALIDATION_ERROR", message: validationError, statusCode: 400 });
  }

  return db.$transaction(async (tx) => {
    // The product editor saves absolute stock values guarded by the product `updatedAt`
    // revision. Bumping it for editable products makes an editor opened before this
    // adjustment fail with a conflict instead of silently reverting it. Done before the
    // inventory lock so both flows lock product -> inventory in the same order.
    await tx.product.updateMany({
      where: {
        sellerId,
        status: { in: [ProductStatus.DRAFT, ProductStatus.REJECTED] },
        variants: { some: { id: variantId, sellerId } },
      },
      data: { updatedAt: new Date() },
    });
    await tx.$queryRaw`SELECT id FROM "inventories" WHERE "variantId" = ${variantId} AND "sellerId" = ${sellerId} FOR UPDATE`;
    const inventory = await tx.inventory.findFirst({ where: { variantId, sellerId } });
    if (!inventory)
      throw new ApplicationError({ code: "NOT_FOUND", message: "Estoque não encontrado.", statusCode: 404 });
    // A correção depende do saldo lido sob o lock: outro ajuste ou venda pode ter mudado o número.
    const quantityChange = getManualAdjustmentChange(adjustment, inventory.availableQuantity);
    if (quantityChange === 0) {
      throw new ApplicationError({
        code: "VALIDATION_ERROR",
        message: "O estoque já está com essa quantidade.",
        statusCode: 400,
      });
    }
    const balance = adjustAvailableInventory(inventory, quantityChange);
    await tx.inventory.update({
      where: { id: inventory.id },
      data: { availableQuantity: balance.availableQuantity, version: { increment: 1 } },
    });
    await tx.inventoryMovement.create({
      data: {
        type: manualAdjustmentMovementTypes[adjustment.kind],
        quantityChange,
        availableQuantityAfter: balance.availableQuantity,
        reservedQuantityAfter: balance.reservedQuantity,
        reason: getManualAdjustmentReason(adjustment),
        inventoryId: inventory.id,
        variantId,
        sellerId,
        actorUserId,
      },
    });
    return balance;
  });
}
