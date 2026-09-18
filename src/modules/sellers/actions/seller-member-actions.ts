"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/database";
import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { asApplicationError } from "@/shared/errors/application-error";

const addMemberSchema = z.object({
  email: z.email("Informe um e-mail válido.").transform((value) => value.toLowerCase()),
  role: z.enum(["ADMIN", "CATALOG", "ORDERS", "FINANCE"]),
});

const updateRoleSchema = z.object({
  role: z.enum(["ADMIN", "CATALOG", "ORDERS", "FINANCE"]),
});

export type SellerMemberActionState = { error?: string; success?: string };

export async function addSellerMemberAction(
  _previousState: SellerMemberActionState,
  formData: FormData,
): Promise<SellerMemberActionState> {
  const context = await requireSellerAccess("SELLER_MANAGE");
  const parsed = addMemberSchema.safeParse({ email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados do membro." };

  try {
    const user = await db.user.findUnique({ where: { email: parsed.data.email } });
    if (!user) return { error: "O usuário precisa criar uma conta no MotoShop antes de ser adicionado." };
    if (user.id === context.session.user.id) return { error: "O responsável atual já faz parte da equipe." };

    const existingMembership = await db.sellerMember.findFirst({ where: { userId: user.id } });
    if (existingMembership) return { error: "Este usuário já está vinculado a uma loja." };

    const member = await db.sellerMember.create({
      data: { sellerId: context.seller.id, userId: user.id, role: parsed.data.role },
    });
    await db.auditLog.create({
      data: {
        action: "SELLER_MEMBER_ADDED",
        entityType: "SELLER_MEMBER",
        entityId: member.id,
        actorUserId: context.session.user.id,
        metadata: { sellerId: context.seller.id, userId: user.id, role: parsed.data.role } as Prisma.InputJsonValue,
      },
    });
    revalidatePath("/seller");
    return { success: `${user.email} foi adicionado à equipe.` };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function updateSellerMemberRoleAction(memberId: string, formData: FormData): Promise<void> {
  const context = await requireSellerAccess("SELLER_MANAGE");
  const parsed = updateRoleSchema.safeParse({ role: formData.get("role") });
  if (!parsed.success) return;

  try {
    const member = await db.sellerMember.findFirst({
      where: { id: memberId, sellerId: context.seller.id },
      include: { user: true },
    });
    if (!member) return;
    if (member.role === "OWNER") return;

    await db.sellerMember.update({ where: { id: member.id }, data: { role: parsed.data.role } });
    await db.auditLog.create({
      data: {
        action: "SELLER_MEMBER_ROLE_UPDATED",
        entityType: "SELLER_MEMBER",
        entityId: member.id,
        actorUserId: context.session.user.id,
        metadata: {
          sellerId: context.seller.id,
          userId: member.userId,
          previousRole: member.role,
          nextRole: parsed.data.role,
        } as Prisma.InputJsonValue,
      },
    });
    revalidatePath("/seller");
  } catch (error) {
    throw asApplicationError(error);
  }
}

export async function removeSellerMemberAction(memberId: string): Promise<void> {
  const context = await requireSellerAccess("SELLER_MANAGE");

  try {
    const member = await db.sellerMember.findFirst({
      where: { id: memberId, sellerId: context.seller.id },
      include: { user: true },
    });
    if (!member) return;
    if (member.role === "OWNER") return;

    await db.sellerMember.delete({ where: { id: member.id } });
    await db.auditLog.create({
      data: {
        action: "SELLER_MEMBER_REMOVED",
        entityType: "SELLER_MEMBER",
        entityId: member.id,
        actorUserId: context.session.user.id,
        metadata: { sellerId: context.seller.id, userId: member.userId, role: member.role } as Prisma.InputJsonValue,
      },
    });
    revalidatePath("/seller");
  } catch (error) {
    throw asApplicationError(error);
  }
}
