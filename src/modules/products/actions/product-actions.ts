"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ProductStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";
import { requireAdminAccess, requireSellerAccess } from "@/modules/auth/application/authorization";
import { adjustAvailableInventory } from "@/modules/inventory/domain/inventory-balance";
import { ApplicationError, asApplicationError } from "@/shared/errors/application-error";

import { getProductReviewIssues } from "../domain/product-review-readiness";
import { createSellerProduct, updateSellerProduct } from "../application/save-product";
import { parseProductForm } from "../schemas/parse-product-form";

export type ProductActionState = { error?: string; success?: string };

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

  let createdProductId: string;
  try {
    createdProductId = await createSellerProduct(
      { sellerId: context.seller.id, storeId: context.store.id, userId: context.session.user.id },
      parsed.data,
    );
    revalidatePath("/seller");
    revalidatePath("/products");
  } catch (error) {
    const applicationError = asApplicationError(error);
    return {
      error:
        applicationError.code === "INTERNAL_ERROR"
          ? "Não foi possível criar o produto. Confira o slug e o SKU."
          : applicationError.message,
    };
  }
  redirect(`/seller/products/${createdProductId}/edit`);
}

export async function submitProductAction(productId: string): Promise<ProductActionState> {
  const context = await requireSellerAccess("PRODUCT_UPDATE");
  const product = await db.product.findFirst({
    where: {
      id: productId,
      sellerId: context.seller.id,
      status: { in: [ProductStatus.DRAFT, ProductStatus.REJECTED] },
    },
    select: {
      id: true,
      category: { select: { active: true } },
      brand: { select: { active: true } },
      variants: { select: { active: true, priceInCents: true } },
    },
  });
  if (!product) return { error: "Produto não encontrado ou já enviado para revisão." };
  const issues = getProductReviewIssues(product);
  if (issues.length > 0) return { error: issues[0] ?? "Confira os dados do produto." };
  const updated = await db.product.updateMany({
    where: {
      id: product.id,
      sellerId: context.seller.id,
      status: { in: [ProductStatus.DRAFT, ProductStatus.REJECTED] },
      category: { active: true },
      brand: { active: true },
      variants: { some: { active: true, priceInCents: { gt: 0 } } },
    },
    data: { status: ProductStatus.SUBMITTED, submittedAt: new Date(), rejectionReason: null },
  });
  if (updated.count === 0) return { error: "O produto mudou. Atualize a página e tente novamente." };
  revalidatePath("/seller");
  revalidatePath("/admin");
  return { success: "Produto enviado para aprovação." };
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
    const updatedProductId = await updateSellerProduct(
      { sellerId: context.seller.id, storeId: context.store.id, userId: context.session.user.id },
      productId,
      parsed.data,
    );
    revalidatePath("/seller");
    revalidatePath(`/seller/products/${updatedProductId}/edit`);
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
  const product = await db.product.findFirst({
    where: { id: productId, status: ProductStatus.SUBMITTED },
    select: {
      id: true,
      status: true,
      category: { select: { active: true } },
      brand: { select: { active: true } },
      variants: { select: { active: true, priceInCents: true } },
      seller: { select: { status: true } },
    },
  });
  if (!product) return { error: "Produto não encontrado ou já revisado." };
  if (product.seller.status !== "APPROVED" && product.seller.status !== "ACTIVE") {
    return { error: "A loja precisa estar ativa antes da aprovação do produto." };
  }
  const issues = getProductReviewIssues(product);
  if (issues.length > 0) return { error: issues[0] ?? "Confira os dados do produto." };
  const approved = await db.$transaction(async (tx) => {
    const updated = await tx.product.updateMany({
      where: {
        id: product.id,
        status: ProductStatus.SUBMITTED,
        seller: { status: { in: ["APPROVED", "ACTIVE"] } },
        category: { active: true },
        brand: { active: true },
        variants: { some: { active: true, priceInCents: { gt: 0 } } },
      },
      data: {
        status: ProductStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedByUserId: session.user.id,
        rejectionReason: null,
      },
    });
    if (updated.count === 0) return false;
    await tx.auditLog.create({
      data: {
        action: "PRODUCT_APPROVED",
        entityType: "Product",
        entityId: product.id,
        metadata: { previousStatus: product.status, nextStatus: ProductStatus.APPROVED },
        actorUserId: session.user.id,
      },
    });
    return true;
  });
  if (!approved) return { error: "O produto ou a loja mudou. Atualize a página e tente novamente." };
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
  const rejected = await db.$transaction(async (tx) => {
    const updated = await tx.product.updateMany({
      where: { id: product.id, status: ProductStatus.SUBMITTED },
      data: {
        status: ProductStatus.REJECTED,
        rejectionReason: cleanReason,
        reviewedAt: new Date(),
        reviewedByUserId: session.user.id,
      },
    });
    if (updated.count === 0) return false;
    await tx.auditLog.create({
      data: {
        action: "PRODUCT_REJECTED",
        entityType: "Product",
        entityId: product.id,
        metadata: { previousStatus: product.status, nextStatus: ProductStatus.REJECTED, reason: cleanReason },
        actorUserId: session.user.id,
      },
    });
    return true;
  });
  if (!rejected) return { error: "O produto já foi revisado. Atualize a página." };
  revalidatePath("/admin");
  revalidatePath("/seller");
  return { success: "Produto rejeitado." };
}
