import "server-only";
import { ProductStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";
import { adjustAvailableInventory } from "@/modules/inventory/domain/inventory-balance";
import { ApplicationError } from "@/shared/errors/application-error";
import {
  commercialAuditSnapshot,
  getMeasurements,
  getVariantCommercialFields,
} from "../domain/product-commercial-fields";
import type { ProductInput } from "../schemas/product-input";

type ProductActor = { sellerId: string; storeId: string; userId: string };

async function getValidFitmentIds(ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return [];
  const fitments = await db.motorcycleFitment.findMany({
    where: {
      id: { in: uniqueIds },
      motorcycleModel: { active: true, manufacturer: { active: true } },
    },
    select: { id: true },
  });
  if (fitments.length !== uniqueIds.length)
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "Uma ou mais motos selecionadas não estão disponíveis.",
      statusCode: 400,
    });
  return uniqueIds;
}

export async function createSellerProduct(actor: ProductActor, input: ProductInput): Promise<string> {
  const [category, brand] = await Promise.all([
    db.category.findFirst({ where: { id: input.categoryId, active: true } }),
    db.brand.findFirst({ where: { id: input.brandId, active: true } }),
  ]);
  if (!category || !brand)
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "Categoria ou marca inválida.",
      statusCode: 400,
    });

  const fitmentIds = await getValidFitmentIds(input.motorcycleFitmentIds);

  const createdProductId = await db.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        name: input.name,
        ...getMeasurements(input),
        slug: input.slug,
        description: input.description,
        sellerId: actor.sellerId,
        storeId: actor.storeId,
        categoryId: category.id,
        brandId: brand.id,
      },
    });
    for (const variantInput of input.variants) {
      const variant = await tx.productVariant.create({
        data: {
          productId: product.id,
          sellerId: actor.sellerId,
          sku: variantInput.sku,
          title: variantInput.title,
          priceInCents: variantInput.priceInCents,
          ...getVariantCommercialFields(variantInput),
        },
      });
      const inventory = await tx.inventory.create({
        data: { variantId: variant.id, sellerId: actor.sellerId, availableQuantity: variantInput.stock },
      });
      if (variantInput.stock > 0) {
        await tx.inventoryMovement.create({
          data: {
            type: "MANUAL_IN",
            quantityChange: variantInput.stock,
            availableQuantityAfter: variantInput.stock,
            reservedQuantityAfter: 0,
            reason: "Estoque inicial do produto",
            inventoryId: inventory.id,
            variantId: variant.id,
            sellerId: actor.sellerId,
            actorUserId: actor.userId,
          },
        });
      }
    }
    if (fitmentIds.length > 0) {
      await tx.productCompatibility.createMany({
        data: fitmentIds.map((motorcycleFitmentId) => ({
          productId: product.id,
          motorcycleFitmentId,
          sellerId: actor.sellerId,
        })),
      });
    }
    return product.id;
  });

  return createdProductId;
}

export async function updateSellerProduct(
  actor: ProductActor,
  productId: string,
  input: ProductInput,
): Promise<string> {
  const product = await db.product.findFirst({
    where: {
      id: productId,
      sellerId: actor.sellerId,
      status: { in: [ProductStatus.DRAFT, ProductStatus.REJECTED] },
    },
    include: { variants: { orderBy: { createdAt: "asc" } } },
  });
  if (!product)
    throw new ApplicationError({
      code: "NOT_FOUND",
      message: "Somente produtos editáveis com variante podem ser alterados.",
      statusCode: 404,
    });

  const [category, brand] = await Promise.all([
    db.category.findFirst({ where: { id: input.categoryId, active: true } }),
    db.brand.findFirst({ where: { id: input.brandId, active: true } }),
  ]);
  if (!category || !brand)
    throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Categoria ou marca inválida.", statusCode: 400 });

  const fitmentIds = await getValidFitmentIds(input.motorcycleFitmentIds);

  await db.$transaction(async (tx) => {
    const updated = await tx.product.updateMany({
      where: {
        id: product.id,
        sellerId: actor.sellerId,
        updatedAt: product.updatedAt,
        status: { in: [ProductStatus.DRAFT, ProductStatus.REJECTED] },
      },
      data: {
        ...getMeasurements(input),
        name: input.name,
        slug: input.slug,
        description: input.description,
        categoryId: input.categoryId,
        brandId: input.brandId,
      },
    });
    if (updated.count !== 1)
      throw new ApplicationError({
        code: "CONFLICT",
        message: "O produto mudou. Atualize a página antes de salvar.",
        statusCode: 409,
      });
    const existingVariantsById = new Map(product.variants.map((variant) => [variant.id, variant]));
    const submittedVariantIds = new Set<string>();
    for (const variantInput of input.variants) {
      if (variantInput.id) {
        const variant = existingVariantsById.get(variantInput.id);
        if (!variant || submittedVariantIds.has(variant.id)) {
          throw new ApplicationError({
            code: "VALIDATION_ERROR",
            message: "Uma ou mais variações não pertencem a este produto.",
            statusCode: 400,
          });
        }
        submittedVariantIds.add(variant.id);
        await tx.productVariant.update({
          where: { id: variant.id },
          data: {
            sku: variantInput.sku,
            title: variantInput.title,
            priceInCents: variantInput.priceInCents,
            ...getVariantCommercialFields(variantInput),
            active: true,
          },
        });
        await tx.$queryRaw`SELECT id FROM "inventories" WHERE "variantId" = ${variant.id} AND "sellerId" = ${actor.sellerId} FOR UPDATE`;
        const inventory = await tx.inventory.findFirst({
          where: { variantId: variant.id, sellerId: actor.sellerId },
        });
        if (!inventory)
          throw new ApplicationError({
            code: "NOT_FOUND",
            message: "Estoque não encontrado para uma variação.",
            statusCode: 404,
          });
        const quantityChange = variantInput.stock - inventory.availableQuantity;
        if (quantityChange !== 0) {
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
              reason: "Atualização da variação pelo seller",
              inventoryId: inventory.id,
              variantId: variant.id,
              sellerId: actor.sellerId,
              actorUserId: actor.userId,
            },
          });
        }
      } else {
        const variant = await tx.productVariant.create({
          data: {
            productId: product.id,
            sellerId: actor.sellerId,
            sku: variantInput.sku,
            title: variantInput.title,
            priceInCents: variantInput.priceInCents,
            ...getVariantCommercialFields(variantInput),
          },
        });
        const inventory = await tx.inventory.create({
          data: { variantId: variant.id, sellerId: actor.sellerId, availableQuantity: variantInput.stock },
        });
        if (variantInput.stock > 0) {
          await tx.inventoryMovement.create({
            data: {
              type: "MANUAL_IN",
              quantityChange: variantInput.stock,
              availableQuantityAfter: variantInput.stock,
              reservedQuantityAfter: 0,
              reason: "Nova variação adicionada pelo seller",
              inventoryId: inventory.id,
              variantId: variant.id,
              sellerId: actor.sellerId,
              actorUserId: actor.userId,
            },
          });
        }
      }
    }
    const variantsToDeactivate = product.variants
      .filter((variant) => !submittedVariantIds.has(variant.id))
      .map((variant) => variant.id);
    await tx.auditLog.create({
      data: {
        action: "PRODUCT_COMMERCIAL_FIELDS_UPDATED",
        entityType: "Product",
        entityId: product.id,
        actorUserId: actor.userId,
        metadata: { previous: commercialAuditSnapshot(product), next: commercialAuditSnapshot(input) },
      },
    });
    if (variantsToDeactivate.length > 0) {
      await tx.productVariant.updateMany({
        where: { id: { in: variantsToDeactivate }, productId: product.id, sellerId: actor.sellerId },
        data: { active: false },
      });
    }
    await tx.productCompatibility.deleteMany({ where: { productId: product.id, sellerId: actor.sellerId } });
    if (fitmentIds.length > 0) {
      await tx.productCompatibility.createMany({
        data: fitmentIds.map((motorcycleFitmentId) => ({
          productId: product.id,
          motorcycleFitmentId,
          sellerId: actor.sellerId,
        })),
      });
    }
  });

  return product.id;
}
