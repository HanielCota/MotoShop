import "server-only";

import { db } from "@/lib/database";
import { ApplicationError } from "@/shared/errors/application-error";

import { adjustAvailableInventory } from "../domain/inventory-balance";

type ManualAdjustmentInput = {
  sellerId: string;
  actorUserId: string;
  variantId: string;
  /** Inteiro diferente de zero; positivo = entrada, negativo = saída. */
  quantityChange: number;
};

/**
 * Ajuste manual de estoque feito pelo lojista. Bloqueia a linha de estoque
 * (`FOR UPDATE`) antes de ler o saldo e registra a movimentação auditável.
 */
export async function adjustInventoryManually(input: ManualAdjustmentInput) {
  const { sellerId, actorUserId, variantId, quantityChange } = input;
  if (!Number.isSafeInteger(quantityChange) || quantityChange === 0) {
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "Informe um ajuste inteiro diferente de zero.",
      statusCode: 400,
    });
  }

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "inventories" WHERE "variantId" = ${variantId} AND "sellerId" = ${sellerId} FOR UPDATE`;
    const inventory = await tx.inventory.findFirst({ where: { variantId, sellerId } });
    if (!inventory)
      throw new ApplicationError({ code: "NOT_FOUND", message: "Estoque não encontrado.", statusCode: 404 });
    const balance = adjustAvailableInventory(inventory, quantityChange);
    await tx.inventory.update({
      where: { id: inventory.id },
      data: { availableQuantity: balance.availableQuantity, version: { increment: 1 } },
    });
    await tx.inventoryMovement.create({
      data: {
        type: quantityChange > 0 ? "MANUAL_IN" : "MANUAL_OUT",
        quantityChange,
        availableQuantityAfter: balance.availableQuantity,
        reservedQuantityAfter: balance.reservedQuantity,
        reason: "Ajuste manual pelo lojista",
        inventoryId: inventory.id,
        variantId,
        sellerId,
        actorUserId,
      },
    });
    return balance;
  });
}
