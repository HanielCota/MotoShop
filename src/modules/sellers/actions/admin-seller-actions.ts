"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/database";
import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { ApplicationError } from "@/shared/errors/application-error";

export async function approveSellerAction(sellerId: string): Promise<void> {
  const session = await requireAdminAccess();
  const seller = await db.seller.findFirst({ where: { id: sellerId, status: "PENDING" } });
  if (!seller)
    throw new ApplicationError({
      code: "CONFLICT",
      message: "A loja não está disponível para esta decisão. Atualize a página.",
    });
  await db.$transaction([
    db.seller.update({ where: { id: seller.id, status: seller.status }, data: { status: "ACTIVE" } }),
    db.auditLog.create({
      data: {
        action: "SELLER_APPROVED",
        entityType: "Seller",
        entityId: seller.id,
        metadata: { previousStatus: seller.status, nextStatus: "ACTIVE" },
        actorUserId: session.user.id,
      },
    }),
  ]);
  revalidatePath("/admin", "layout");
  revalidatePath("/seller", "layout");
}

export async function rejectSellerAction(sellerId: string): Promise<void> {
  const session = await requireAdminAccess();
  const seller = await db.seller.findFirst({ where: { id: sellerId, status: "PENDING" } });
  if (!seller)
    throw new ApplicationError({
      code: "CONFLICT",
      message: "A loja não está disponível para esta decisão. Atualize a página.",
    });
  await db.$transaction([
    db.seller.update({ where: { id: seller.id, status: seller.status }, data: { status: "REJECTED" } }),
    db.auditLog.create({
      data: {
        action: "SELLER_REJECTED",
        entityType: "Seller",
        entityId: seller.id,
        metadata: { previousStatus: seller.status, nextStatus: "REJECTED" },
        actorUserId: session.user.id,
      },
    }),
  ]);
  revalidatePath("/admin", "layout");
  revalidatePath("/seller", "layout");
}

export async function suspendSellerAction(sellerId: string): Promise<void> {
  const session = await requireAdminAccess();
  const seller = await db.seller.findFirst({ where: { id: sellerId, status: { in: ["APPROVED", "ACTIVE"] } } });
  if (!seller)
    throw new ApplicationError({
      code: "CONFLICT",
      message: "A loja não está disponível para esta decisão. Atualize a página.",
    });
  await db.$transaction([
    db.seller.update({ where: { id: seller.id, status: seller.status }, data: { status: "SUSPENDED" } }),
    db.auditLog.create({
      data: {
        action: "SELLER_SUSPENDED",
        entityType: "Seller",
        entityId: seller.id,
        metadata: { previousStatus: seller.status, nextStatus: "SUSPENDED" },
        actorUserId: session.user.id,
      },
    }),
  ]);
  revalidatePath("/admin", "layout");
  revalidatePath("/seller", "layout");
}

export async function reactivateSellerAction(sellerId: string): Promise<void> {
  const session = await requireAdminAccess();
  const seller = await db.seller.findFirst({ where: { id: sellerId, status: "SUSPENDED" } });
  if (!seller)
    throw new ApplicationError({
      code: "CONFLICT",
      message: "A loja não está disponível para esta decisão. Atualize a página.",
    });
  await db.$transaction([
    db.seller.update({ where: { id: seller.id, status: seller.status }, data: { status: "ACTIVE" } }),
    db.auditLog.create({
      data: {
        action: "SELLER_REACTIVATED",
        entityType: "Seller",
        entityId: seller.id,
        metadata: { previousStatus: seller.status, nextStatus: "ACTIVE" },
        actorUserId: session.user.id,
      },
    }),
  ]);
  revalidatePath("/admin", "layout");
  revalidatePath("/seller", "layout");
}
