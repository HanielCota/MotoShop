import "server-only";

import { ProductStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";

import { getProductReviewIssues } from "../domain/product-review-readiness";

/**
 * Transições de status de produto (envio para revisão, arquivamento, restauração,
 * aprovação e rejeição). Cada transição usa `updateMany` condicionado ao status
 * esperado (lock otimista) e grava auditoria na mesma transação.
 */
export type ProductLifecycleResult = { ok: true } | { ok: false; error: string };

type SellerActor = { sellerId: string; userId: string };

const editableStatuses = [ProductStatus.DRAFT, ProductStatus.REJECTED];

export async function submitProductForReview(actor: SellerActor, productId: string): Promise<ProductLifecycleResult> {
  const product = await db.product.findFirst({
    where: { id: productId, sellerId: actor.sellerId, status: { in: editableStatuses } },
    select: {
      id: true,
      category: { select: { active: true } },
      brand: { select: { active: true } },
      variants: { select: { active: true, priceInCents: true } },
    },
  });
  if (!product) return { ok: false, error: "Produto não encontrado ou já enviado para revisão." };
  const issues = getProductReviewIssues(product);
  if (issues.length > 0) return { ok: false, error: issues[0] ?? "Confira os dados do produto." };
  const updated = await db.product.updateMany({
    where: {
      id: product.id,
      sellerId: actor.sellerId,
      status: { in: editableStatuses },
      category: { active: true },
      brand: { active: true },
      variants: { some: { active: true, priceInCents: { gt: 0 } } },
    },
    data: { status: ProductStatus.SUBMITTED, submittedAt: new Date(), rejectionReason: null },
  });
  if (updated.count === 0) return { ok: false, error: "O produto mudou. Atualize a página e tente novamente." };
  return { ok: true };
}

/** Arquiva um rascunho ou produto rejeitado. Retorna `false` se nada mudou. */
export async function archiveSellerProduct(actor: SellerActor, productId: string): Promise<boolean> {
  const product = await db.product.findFirst({
    where: { id: productId, sellerId: actor.sellerId, status: { in: editableStatuses } },
    select: { id: true, status: true },
  });
  if (!product) return false;
  return db.$transaction(async (tx) => {
    const updated = await tx.product.updateMany({
      where: { id: product.id, sellerId: actor.sellerId, status: product.status },
      data: { status: ProductStatus.ARCHIVED },
    });
    if (updated.count !== 1) return false;
    await tx.auditLog.create({
      data: {
        action: "PRODUCT_ARCHIVED",
        entityType: "Product",
        entityId: product.id,
        metadata: { previousStatus: product.status, nextStatus: ProductStatus.ARCHIVED },
        actorUserId: actor.userId,
      },
    });
    return true;
  });
}

/** Restaura um produto arquivado como rascunho. Retorna `false` se nada mudou. */
export async function restoreSellerProduct(actor: SellerActor, productId: string): Promise<boolean> {
  const product = await db.product.findFirst({
    where: { id: productId, sellerId: actor.sellerId, status: ProductStatus.ARCHIVED },
    select: { id: true, status: true },
  });
  if (!product) return false;
  return db.$transaction(async (tx) => {
    const result = await tx.product.updateMany({
      where: { id: product.id, sellerId: actor.sellerId, status: ProductStatus.ARCHIVED },
      data: { status: ProductStatus.DRAFT, rejectionReason: null },
    });
    if (result.count !== 1) return false;
    await tx.auditLog.create({
      data: {
        action: "PRODUCT_RESTORED",
        entityType: "Product",
        entityId: product.id,
        metadata: { previousStatus: product.status, nextStatus: ProductStatus.DRAFT },
        actorUserId: actor.userId,
      },
    });
    return true;
  });
}

export async function approveSubmittedProduct(
  admin: { userId: string },
  productId: string,
): Promise<ProductLifecycleResult> {
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
  if (!product) return { ok: false, error: "Produto não encontrado ou já revisado." };
  if (product.seller.status !== "APPROVED" && product.seller.status !== "ACTIVE") {
    return { ok: false, error: "A loja precisa estar ativa antes da aprovação do produto." };
  }
  const issues = getProductReviewIssues(product);
  if (issues.length > 0) return { ok: false, error: issues[0] ?? "Confira os dados do produto." };
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
        reviewedByUserId: admin.userId,
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
        actorUserId: admin.userId,
      },
    });
    return true;
  });
  if (!approved) return { ok: false, error: "O produto ou a loja mudou. Atualize a página e tente novamente." };
  return { ok: true };
}

export async function rejectSubmittedProduct(
  admin: { userId: string },
  productId: string,
  reason: string,
): Promise<ProductLifecycleResult> {
  const product = await db.product.findFirst({
    where: { id: productId, status: ProductStatus.SUBMITTED },
    select: { id: true, status: true },
  });
  if (!product) return { ok: false, error: "Produto não encontrado ou já revisado." };
  const rejected = await db.$transaction(async (tx) => {
    const updated = await tx.product.updateMany({
      where: { id: product.id, status: ProductStatus.SUBMITTED },
      data: {
        status: ProductStatus.REJECTED,
        rejectionReason: reason,
        reviewedAt: new Date(),
        reviewedByUserId: admin.userId,
      },
    });
    if (updated.count === 0) return false;
    await tx.auditLog.create({
      data: {
        action: "PRODUCT_REJECTED",
        entityType: "Product",
        entityId: product.id,
        metadata: { previousStatus: product.status, nextStatus: ProductStatus.REJECTED, reason },
        actorUserId: admin.userId,
      },
    });
    return true;
  });
  if (!rejected) return { ok: false, error: "O produto já foi revisado. Atualize a página." };
  return { ok: true };
}
