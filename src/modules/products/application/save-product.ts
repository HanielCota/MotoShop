import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { ProductStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";
import { adjustAvailableInventory } from "@/modules/inventory/domain/inventory-balance";
import { ApplicationError } from "@/shared/errors/application-error";
import {
  commercialAuditSnapshot,
  getMeasurements,
  getVariantCommercialFields,
} from "../domain/product-commercial-fields";
import { getVariantAttributes } from "../domain/variant-attributes";
import type { ProductInput } from "../schemas/product-input";

type ProductActor = { sellerId: string; storeId: string; userId: string };
type VariantInput = ProductInput["variants"][number];
type EditableProduct = NonNullable<Awaited<ReturnType<typeof findEditableProduct>>>;
type ExistingVariant = EditableProduct["variants"][number];

const EDITABLE_PRODUCT_STATUSES = [ProductStatus.DRAFT, ProductStatus.REJECTED];

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

async function requireActiveCategoryAndBrand(input: ProductInput) {
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

  return { category, brand };
}

export async function createSellerProduct(actor: ProductActor, input: ProductInput): Promise<string> {
  const { category, brand } = await requireActiveCategoryAndBrand(input);
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
      await createVariantWithInventory(tx, actor, product.id, variantInput, "Estoque inicial do produto");
    }
    await createCompatibilities(tx, actor, product.id, fitmentIds);
    return product.id;
  });

  return createdProductId;
}

export async function updateSellerProduct(
  actor: ProductActor,
  productId: string,
  input: ProductInput,
  options: { revision?: Date } = {},
): Promise<string> {
  const product = await findEditableProduct(actor, productId);
  if (!product)
    throw new ApplicationError({
      code: "NOT_FOUND",
      message: "Somente produtos editáveis com variante podem ser alterados.",
      statusCode: 404,
    });
  // The revision is the `updatedAt` the editor loaded. When it differs from the
  // current row (or changes before the write below), someone else saved first.
  const revision = options.revision ?? product.updatedAt;
  if (revision.getTime() !== product.updatedAt.getTime()) throw productChangedConflict();

  await requireActiveCategoryAndBrand(input);
  const fitmentIds = await getValidFitmentIds(input.motorcycleFitmentIds);

  await db.$transaction(async (tx) => {
    await updateProductFields(tx, actor, product.id, revision, input);
    const submittedVariantIds = await saveSubmittedVariants(tx, actor, product, input.variants);
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
    await deactivateVariants(tx, actor, product.id, variantsToDeactivate);
    await tx.productCompatibility.deleteMany({ where: { productId: product.id, sellerId: actor.sellerId } });
    await createCompatibilities(tx, actor, product.id, fitmentIds);
  });

  return product.id;
}

async function findEditableProduct(actor: ProductActor, productId: string) {
  return db.product.findFirst({
    where: {
      id: productId,
      sellerId: actor.sellerId,
      status: { in: EDITABLE_PRODUCT_STATUSES },
    },
    include: { variants: { orderBy: { createdAt: "asc" } } },
  });
}

async function updateProductFields(
  tx: Prisma.TransactionClient,
  actor: ProductActor,
  productId: string,
  revision: Date,
  input: ProductInput,
) {
  const updated = await tx.product.updateMany({
    where: {
      id: productId,
      sellerId: actor.sellerId,
      updatedAt: revision,
      status: { in: EDITABLE_PRODUCT_STATUSES },
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
  if (updated.count !== 1) throw productChangedConflict();
}

/** Creates new variants and updates existing ones in submission order; returns the ids kept. */
async function saveSubmittedVariants(
  tx: Prisma.TransactionClient,
  actor: ProductActor,
  product: EditableProduct,
  variantInputs: VariantInput[],
) {
  const existingVariantsById = new Map(product.variants.map((variant) => [variant.id, variant]));
  const submittedVariantIds = new Set<string>();
  for (const variantInput of variantInputs) {
    if (!variantInput.id) {
      await createVariantWithInventory(tx, actor, product.id, variantInput, "Nova variação adicionada pelo seller");
      continue;
    }

    const variant = existingVariantsById.get(variantInput.id);
    if (!variant || submittedVariantIds.has(variant.id)) {
      throw new ApplicationError({
        code: "VALIDATION_ERROR",
        message: "Uma ou mais variações não pertencem a este produto.",
        statusCode: 400,
      });
    }
    submittedVariantIds.add(variant.id);
    await updateExistingVariant(tx, actor, variant, variantInput);
  }

  return submittedVariantIds;
}

async function createVariantWithInventory(
  tx: Prisma.TransactionClient,
  actor: ProductActor,
  productId: string,
  variantInput: VariantInput,
  reason: string,
) {
  const variant = await tx.productVariant.create({
    data: {
      productId,
      sellerId: actor.sellerId,
      sku: variantInput.sku,
      title: variantInput.title,
      priceInCents: variantInput.priceInCents,
      ...getVariantCommercialFields(variantInput),
      ...getVariantAttributes(variantInput),
    },
  });
  const inventory = await tx.inventory.create({
    data: { variantId: variant.id, sellerId: actor.sellerId, availableQuantity: variantInput.stock },
  });
  if (variantInput.stock <= 0) return;

  await tx.inventoryMovement.create({
    data: {
      type: "MANUAL_IN",
      quantityChange: variantInput.stock,
      availableQuantityAfter: variantInput.stock,
      reservedQuantityAfter: 0,
      reason,
      inventoryId: inventory.id,
      variantId: variant.id,
      sellerId: actor.sellerId,
      actorUserId: actor.userId,
    },
  });
}

async function updateExistingVariant(
  tx: Prisma.TransactionClient,
  actor: ProductActor,
  variant: ExistingVariant,
  variantInput: VariantInput,
) {
  await tx.productVariant.update({
    where: { id: variant.id },
    data: {
      sku: variantInput.sku,
      title: variantInput.title,
      priceInCents: variantInput.priceInCents,
      ...getVariantCommercialFields(variantInput),
      ...getVariantAttributes(variantInput),
      active: true,
    },
  });
  await adjustVariantStock(tx, actor, variant.id, variantInput.stock);
}

async function adjustVariantStock(
  tx: Prisma.TransactionClient,
  actor: ProductActor,
  variantId: string,
  targetStock: number,
) {
  await tx.$queryRaw`SELECT id FROM "inventories" WHERE "variantId" = ${variantId} AND "sellerId" = ${actor.sellerId} FOR UPDATE`;
  const inventory = await tx.inventory.findFirst({
    where: { variantId, sellerId: actor.sellerId },
  });
  if (!inventory)
    throw new ApplicationError({
      code: "NOT_FOUND",
      message: "Estoque não encontrado para uma variação.",
      statusCode: 404,
    });
  const quantityChange = targetStock - inventory.availableQuantity;
  if (quantityChange === 0) return;

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
      variantId,
      sellerId: actor.sellerId,
      actorUserId: actor.userId,
    },
  });
}

async function deactivateVariants(
  tx: Prisma.TransactionClient,
  actor: ProductActor,
  productId: string,
  variantIds: string[],
) {
  if (variantIds.length === 0) return;

  await tx.productVariant.updateMany({
    where: { id: { in: variantIds }, productId, sellerId: actor.sellerId },
    data: { active: false },
  });
}

async function createCompatibilities(
  tx: Prisma.TransactionClient,
  actor: ProductActor,
  productId: string,
  fitmentIds: string[],
) {
  if (fitmentIds.length === 0) return;

  await tx.productCompatibility.createMany({
    data: fitmentIds.map((motorcycleFitmentId) => ({
      productId,
      motorcycleFitmentId,
      sellerId: actor.sellerId,
    })),
  });
}

function productChangedConflict() {
  return new ApplicationError({
    code: "CONFLICT",
    message: "O produto foi alterado por outra pessoa. Recarregue a página.",
    statusCode: 409,
  });
}
