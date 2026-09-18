"use server";

import { revalidatePath } from "next/cache";

import { ProductStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";
import { slugify } from "@/lib/utils";
import { requireAdminAccess, requireSellerAccess } from "@/modules/auth/application/authorization";
import { adjustAvailableInventory } from "@/modules/inventory/domain/inventory-balance";
import { ApplicationError, asApplicationError } from "@/shared/errors/application-error";

import { productInputSchema } from "../schemas/product-input";

export type ProductActionState = { error?: string; success?: string };

function parseProductForm(formData: FormData) {
  const variantTitles = formData.getAll("variantTitle");
  const variantSkus = formData.getAll("sku");
  const variantPrices = formData.getAll("priceInCents");
  const variantStocks = formData.getAll("stock");
  const variantIds = formData.getAll("variantId");

  return productInputSchema.safeParse({
    name: formData.get("name"),
    slug: slugify(String(formData.get("slug") || formData.get("name") || "")),
    description: formData.get("description"),
    categoryId: formData.get("categoryId"),
    brandId: formData.get("brandId"),
    variants: variantTitles.map((_, index) => ({
      id: typeof variantIds[index] === "string" && variantIds[index] ? variantIds[index] : undefined,
      title: variantTitles[index],
      sku: variantSkus[index],
      priceInCents: variantPrices[index],
      stock: variantStocks[index],
    })),
    motorcycleFitmentIds: formData
      .getAll("motorcycleFitmentIds")
      .filter((value): value is string => typeof value === "string"),
  });
}

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

export async function createProductAction(
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const context = await requireSellerAccess("PRODUCT_CREATE");
  const parsed = parseProductForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados do produto." };
  if (new Set(parsed.data.variants.map((variant) => variant.sku.toLowerCase())).size !== parsed.data.variants.length) {
    return { error: "Cada variação precisa ter um SKU diferente." };
  }

  try {
    const [category, brand] = await Promise.all([
      db.category.findFirst({ where: { id: parsed.data.categoryId, active: true } }),
      db.brand.findFirst({ where: { id: parsed.data.brandId, active: true } }),
    ]);
    if (!category || !brand)
      throw new ApplicationError({
        code: "VALIDATION_ERROR",
        message: "Categoria ou marca inválida.",
        statusCode: 400,
      });

    const fitmentIds = await getValidFitmentIds(parsed.data.motorcycleFitmentIds);

    await db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: parsed.data.name,
          slug: parsed.data.slug,
          description: parsed.data.description,
          sellerId: context.seller.id,
          storeId: context.store.id,
          categoryId: category.id,
          brandId: brand.id,
        },
      });
      for (const variantInput of parsed.data.variants) {
        const variant = await tx.productVariant.create({
          data: {
            productId: product.id,
            sellerId: context.seller.id,
            sku: variantInput.sku,
            title: variantInput.title,
            priceInCents: variantInput.priceInCents,
          },
        });
        const inventory = await tx.inventory.create({
          data: { variantId: variant.id, sellerId: context.seller.id, availableQuantity: variantInput.stock },
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
              sellerId: context.seller.id,
              actorUserId: context.session.user.id,
            },
          });
        }
      }
      if (fitmentIds.length > 0) {
        await tx.productCompatibility.createMany({
          data: fitmentIds.map((motorcycleFitmentId) => ({
            productId: product.id,
            motorcycleFitmentId,
            sellerId: context.seller.id,
          })),
        });
      }
    });
    revalidatePath("/seller");
    revalidatePath("/products");
    return { success: "Produto criado como rascunho." };
  } catch (error) {
    const applicationError = asApplicationError(error);
    return {
      error:
        applicationError.code === "INTERNAL_ERROR"
          ? "Não foi possível criar o produto. Confira o slug e o SKU."
          : applicationError.message,
    };
  }
}

export async function submitProductAction(productId: string): Promise<void> {
  const context = await requireSellerAccess("PRODUCT_UPDATE");
  const product = await db.product.findFirst({ where: { id: productId, sellerId: context.seller.id } });
  if (!product || (product.status !== ProductStatus.DRAFT && product.status !== ProductStatus.REJECTED)) return;
  await db.product.update({
    where: { id: product.id },
    data: { status: ProductStatus.SUBMITTED, submittedAt: new Date(), rejectionReason: null },
  });
  revalidatePath("/seller");
  revalidatePath("/admin");
}

export async function updateProductAction(
  productId: string,
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const context = await requireSellerAccess("PRODUCT_UPDATE");
  const parsed = parseProductForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados do produto." };
  if (new Set(parsed.data.variants.map((variant) => variant.sku.toLowerCase())).size !== parsed.data.variants.length) {
    return { error: "Cada variação precisa ter um SKU diferente." };
  }

  try {
    const product = await db.product.findFirst({
      where: {
        id: productId,
        sellerId: context.seller.id,
        status: { in: [ProductStatus.DRAFT, ProductStatus.REJECTED] },
      },
      include: { variants: { orderBy: { createdAt: "asc" } } },
    });
    if (!product) return { error: "Somente produtos editáveis com variante podem ser alterados." };

    const [category, brand] = await Promise.all([
      db.category.findFirst({ where: { id: parsed.data.categoryId, active: true } }),
      db.brand.findFirst({ where: { id: parsed.data.brandId, active: true } }),
    ]);
    if (!category || !brand) return { error: "Categoria ou marca inválida." };

    const fitmentIds = await getValidFitmentIds(parsed.data.motorcycleFitmentIds);

    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: product.id },
        data: {
          name: parsed.data.name,
          slug: parsed.data.slug,
          description: parsed.data.description,
          categoryId: parsed.data.categoryId,
          brandId: parsed.data.brandId,
        },
      });
      const existingVariantsById = new Map(product.variants.map((variant) => [variant.id, variant]));
      const submittedVariantIds = new Set<string>();
      for (const variantInput of parsed.data.variants) {
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
              active: true,
            },
          });
          const inventory = await tx.inventory.findFirst({
            where: { variantId: variant.id, sellerId: context.seller.id },
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
                sellerId: context.seller.id,
                actorUserId: context.session.user.id,
              },
            });
          }
        } else {
          const variant = await tx.productVariant.create({
            data: {
              productId: product.id,
              sellerId: context.seller.id,
              sku: variantInput.sku,
              title: variantInput.title,
              priceInCents: variantInput.priceInCents,
            },
          });
          const inventory = await tx.inventory.create({
            data: { variantId: variant.id, sellerId: context.seller.id, availableQuantity: variantInput.stock },
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
                sellerId: context.seller.id,
                actorUserId: context.session.user.id,
              },
            });
          }
        }
      }
      const variantsToDeactivate = product.variants
        .filter((variant) => !submittedVariantIds.has(variant.id))
        .map((variant) => variant.id);
      if (variantsToDeactivate.length > 0) {
        await tx.productVariant.updateMany({
          where: { id: { in: variantsToDeactivate }, productId: product.id, sellerId: context.seller.id },
          data: { active: false },
        });
      }
      await tx.productCompatibility.deleteMany({ where: { productId: product.id, sellerId: context.seller.id } });
      if (fitmentIds.length > 0) {
        await tx.productCompatibility.createMany({
          data: fitmentIds.map((motorcycleFitmentId) => ({
            productId: product.id,
            motorcycleFitmentId,
            sellerId: context.seller.id,
          })),
        });
      }
    });

    revalidatePath("/seller");
    revalidatePath(`/seller/products/${product.id}/edit`);
    return { success: "Produto atualizado." };
  } catch (error) {
    const applicationError = asApplicationError(error);
    return {
      error:
        applicationError.code === "INTERNAL_ERROR"
          ? "Não foi possível atualizar o produto. Confira o slug e o SKU."
          : applicationError.message,
    };
  }
}

export async function archiveProductAction(productId: string): Promise<void> {
  const context = await requireSellerAccess("PRODUCT_UPDATE");
  await db.product.updateMany({
    where: {
      id: productId,
      sellerId: context.seller.id,
      status: { in: [ProductStatus.DRAFT, ProductStatus.REJECTED] },
    },
    data: { status: ProductStatus.ARCHIVED },
  });
  revalidatePath("/seller");
}

export async function restoreProductAction(productId: string): Promise<void> {
  const context = await requireSellerAccess("PRODUCT_UPDATE");
  const product = await db.product.findFirst({
    where: { id: productId, sellerId: context.seller.id, status: ProductStatus.ARCHIVED },
    select: { id: true, status: true },
  });
  if (!product) return;
  await db.$transaction([
    db.product.update({ where: { id: product.id }, data: { status: ProductStatus.DRAFT, rejectionReason: null } }),
    db.auditLog.create({
      data: {
        action: "PRODUCT_RESTORED",
        entityType: "Product",
        entityId: product.id,
        metadata: { previousStatus: product.status, nextStatus: ProductStatus.DRAFT },
        actorUserId: context.session.user.id,
      },
    }),
  ]);
  revalidatePath("/seller");
}

export async function adjustInventoryAction(variantId: string, quantityChange: number): Promise<ProductActionState> {
  const context = await requireSellerAccess("PRODUCT_UPDATE");
  if (!Number.isSafeInteger(quantityChange) || quantityChange === 0)
    return { error: "Informe um ajuste inteiro diferente de zero." };
  try {
    await db.$transaction(async (tx) => {
      const inventory = await tx.inventory.findFirst({ where: { variantId, sellerId: context.seller.id } });
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
          reason: "Ajuste manual pelo seller",
          inventoryId: inventory.id,
          variantId,
          sellerId: context.seller.id,
          actorUserId: context.session.user.id,
        },
      });
    });
    revalidatePath("/seller");
    revalidatePath("/products");
    return { success: "Estoque atualizado." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function approveProductAction(productId: string): Promise<ProductActionState> {
  const session = await requireAdminAccess();
  const product = await db.product.findFirst({ where: { id: productId, status: ProductStatus.SUBMITTED } });
  if (!product) return { error: "Produto não encontrado ou já revisado." };
  await db.$transaction([
    db.product.update({
      where: { id: product.id },
      data: {
        status: ProductStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedByUserId: session.user.id,
        rejectionReason: null,
      },
    }),
    db.auditLog.create({
      data: {
        action: "PRODUCT_APPROVED",
        entityType: "Product",
        entityId: product.id,
        metadata: { previousStatus: product.status, nextStatus: ProductStatus.APPROVED },
        actorUserId: session.user.id,
      },
    }),
  ]);
  revalidatePath("/admin");
  revalidatePath("/products");
  return { success: "Produto aprovado." };
}

export async function rejectProductAction(productId: string, formData: FormData): Promise<ProductActionState> {
  const session = await requireAdminAccess();
  const cleanReason = String(formData.get("reason") ?? "").trim();
  if (cleanReason.length < 5) return { error: "Informe o motivo da rejeição." };
  const product = await db.product.findFirst({ where: { id: productId, status: ProductStatus.SUBMITTED } });
  if (!product) return { error: "Produto não encontrado ou já revisado." };
  await db.$transaction([
    db.product.update({
      where: { id: product.id },
      data: {
        status: ProductStatus.REJECTED,
        rejectionReason: cleanReason,
        reviewedAt: new Date(),
        reviewedByUserId: session.user.id,
      },
    }),
    db.auditLog.create({
      data: {
        action: "PRODUCT_REJECTED",
        entityType: "Product",
        entityId: product.id,
        metadata: { previousStatus: product.status, nextStatus: ProductStatus.REJECTED, reason: cleanReason },
        actorUserId: session.user.id,
      },
    }),
  ]);
  revalidatePath("/admin");
  revalidatePath("/seller");
  return { success: "Produto rejeitado." };
}
