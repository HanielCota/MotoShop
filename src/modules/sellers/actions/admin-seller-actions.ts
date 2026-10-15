"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/database";
import { requireAdminAccess } from "@/modules/auth/application/authorization";
import type { SellerStatus } from "@/generated/prisma/enums";
import { ApplicationError } from "@/shared/errors/application-error";
import { assertRecordId } from "@/shared/validation/record-id";

/**
 * A mesma decisão repetida (clique duplo no botão ou dois administradores decidindo igual) não é
 * uma transição inválida: o seller já está no status pretendido, então nada muda e nada é
 * auditado; só revalida para a tela mostrar o status atual em vez de derrubar a área com erro.
 * Qualquer outra divergência continua sendo recusada.
 */
async function handleUnavailableSeller(sellerId: string, targetStatus: SellerStatus): Promise<void> {
  const alreadyApplied = await db.seller.findFirst({
    where: { id: sellerId, status: targetStatus },
    select: { id: true },
  });
  if (!alreadyApplied) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "A loja não está disponível para esta decisão. Atualize a página.",
    });
  }
  revalidatePath("/admin", "layout");
}

export async function approveSellerAction(sellerId: string): Promise<void> {
  const session = await requireAdminAccess();
  assertRecordId(sellerId, "Loja inválida.");
  const seller = await db.seller.findFirst({ where: { id: sellerId, status: "PENDING" } });
  if (!seller) return handleUnavailableSeller(sellerId, "ACTIVE");
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

const rejectSellerSchema = z.object({
  reason: z
    .string("Informe o motivo da recusa.")
    .trim()
    .min(5, "Informe o motivo da recusa com pelo menos 5 caracteres.")
    .max(1000, "Use no máximo 1000 caracteres no motivo."),
});

export type RejectSellerResult = { error?: string } | void;

/** Recusa exige motivo, gravado na loja (o lojista vê na Central) e na auditoria (BUG-005). */
export async function rejectSellerAction(sellerId: string, input: unknown): Promise<RejectSellerResult> {
  const session = await requireAdminAccess();
  assertRecordId(sellerId, "Loja inválida.");
  const parsed = rejectSellerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Informe o motivo da recusa." };

  const seller = await db.seller.findFirst({ where: { id: sellerId, status: "PENDING" } });
  if (!seller) return handleUnavailableSeller(sellerId, "REJECTED");
  const { reason } = parsed.data;
  await db.$transaction([
    db.seller.update({
      where: { id: seller.id, status: seller.status },
      data: { status: "REJECTED", rejectionReason: reason },
    }),
    db.auditLog.create({
      data: {
        action: "SELLER_REJECTED",
        entityType: "Seller",
        entityId: seller.id,
        metadata: { previousStatus: seller.status, nextStatus: "REJECTED", reason },
        actorUserId: session.user.id,
      },
    }),
  ]);
  revalidatePath("/admin", "layout");
  revalidatePath("/seller", "layout");
}

export async function suspendSellerAction(sellerId: string): Promise<void> {
  const session = await requireAdminAccess();
  assertRecordId(sellerId, "Loja inválida.");
  const seller = await db.seller.findFirst({ where: { id: sellerId, status: { in: ["APPROVED", "ACTIVE"] } } });
  if (!seller) return handleUnavailableSeller(sellerId, "SUSPENDED");
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
  assertRecordId(sellerId, "Loja inválida.");
  const seller = await db.seller.findFirst({ where: { id: sellerId, status: "SUSPENDED" } });
  if (!seller) return handleUnavailableSeller(sellerId, "ACTIVE");
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
