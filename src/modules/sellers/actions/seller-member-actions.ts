"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/database";
import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { toActionError } from "@/shared/errors/action-error";

import { consumeRateLimit } from "@/shared/rate-limit/consume-rate-limit";

import {
  createSellerMemberInvite,
  getSellerInviteUrl,
  leaveSellerStore,
  renewSellerMemberInviteLink,
  revokeSellerMemberInvite,
} from "../application/member-invites";
import { sendSellerInviteEmail } from "../application/send-seller-invite-email";
import { SELLER_INVITE_SENT_MESSAGE } from "../domain/member-invite";
import { canManageSellerMember } from "../domain/member-management";
import { getSellerMemberRoleLabel } from "../domain/member-roles";
import { readSellerInviteForm, sellerInviteSchema } from "../schemas/member-invite";

const memberIdSchema = z.string().cuid();
const updateRoleSchema = z.object({
  role: z.enum(["ADMIN", "CATALOG", "ORDERS", "FINANCE"]),
});

const INVITE_RATE_LIMIT = { windowSeconds: 3600, max: 10 } as const;

export type SellerMemberActionState = { error?: string; success?: string; inviteUrl?: string };
export type SellerInviteLinkResult = { error?: string; url?: string };

/**
 * Convida um e-mail para a equipe (M-04). A resposta é a mesma exista ou não uma conta com o
 * e-mail; o vínculo só nasce quando a pessoa aceita. Limite de convites por loja contra enumeração.
 */
export async function inviteSellerMemberAction(
  _previousState: SellerMemberActionState,
  formData: FormData,
): Promise<SellerMemberActionState> {
  const context = await requireSellerAccess("SELLER_MANAGE");
  const parsed = sellerInviteSchema.safeParse(readSellerInviteForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados do convite." };

  try {
    const rateLimit = await consumeRateLimit({ key: `seller-invite:${context.seller.id}`, ...INVITE_RATE_LIMIT });
    if (!rateLimit.allowed) return { error: "Muitos convites em pouco tempo. Tente de novo mais tarde." };

    const actor = {
      sellerId: context.seller.id,
      actorUserId: context.session.user.id,
      actorRole: context.membership.role,
    };
    const result = await createSellerMemberInvite(actor, parsed.data);
    if (!result.ok) return { error: result.error };

    const inviteUrl = getSellerInviteUrl(result.token);
    await sendSellerInviteEmail({
      inviteId: result.inviteId,
      to: parsed.data.email,
      storeName: result.storeName,
      roleLabel: getSellerMemberRoleLabel(parsed.data.role),
      url: inviteUrl,
      token: result.token,
    });
    revalidatePath("/seller/settings");
    return { success: SELLER_INVITE_SENT_MESSAGE, inviteUrl };
  } catch (error) {
    return { error: toActionError(error, "inviteSellerMemberAction").message };
  }
}

/** Gera e devolve um novo link do convite pendente; o link anterior deixa de valer. */
export async function renewSellerInviteLinkAction(inviteId: string): Promise<SellerInviteLinkResult> {
  const context = await requireSellerAccess("SELLER_MANAGE");
  const parsedInviteId = memberIdSchema.safeParse(inviteId);
  if (!parsedInviteId.success) return { error: "Convite inválido." };

  try {
    const actor = {
      sellerId: context.seller.id,
      actorUserId: context.session.user.id,
      actorRole: context.membership.role,
    };
    const result = await renewSellerMemberInviteLink(actor, parsedInviteId.data);
    if (!result.ok) return { error: result.error };
    revalidatePath("/seller/settings");
    return { url: getSellerInviteUrl(result.token) };
  } catch (error) {
    return { error: toActionError(error, "renewSellerInviteLinkAction").message };
  }
}

export async function revokeSellerInviteAction(inviteId: string): Promise<void> {
  const context = await requireSellerAccess("SELLER_MANAGE");
  const parsedInviteId = memberIdSchema.safeParse(inviteId);
  if (!parsedInviteId.success) return;

  try {
    const actor = {
      sellerId: context.seller.id,
      actorUserId: context.session.user.id,
      actorRole: context.membership.role,
    };
    if (await revokeSellerMemberInvite(actor, parsedInviteId.data)) revalidatePath("/seller/settings");
  } catch (error) {
    throw toActionError(error, "revokeSellerInviteAction");
  }
}

/** Qualquer membro, menos o responsável, pode sair da loja por conta própria. */
export async function leaveSellerStoreAction(): Promise<SellerMemberActionState> {
  const context = await requireSellerAccess();
  try {
    const result = await leaveSellerStore(context.session.user.id);
    if (!result.ok) return { error: result.error };
  } catch (error) {
    return { error: toActionError(error, "leaveSellerStoreAction").message };
  }

  revalidatePath("/seller", "layout");
  redirect("/seller");
}

export async function updateSellerMemberRoleAction(memberId: string, formData: FormData): Promise<void> {
  const context = await requireSellerAccess("SELLER_MANAGE");
  const parsed = updateRoleSchema.safeParse({ role: formData.get("role") });
  const parsedMemberId = memberIdSchema.safeParse(memberId);
  if (!parsed.success || !parsedMemberId.success) return;
  memberId = parsedMemberId.data;

  try {
    const updated = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "seller_members" WHERE id = ${memberId} AND "sellerId" = ${context.seller.id} FOR UPDATE`;
      const member = await tx.sellerMember.findFirst({ where: { id: memberId, sellerId: context.seller.id } });
      if (!member) return false;
      const allowed = canManageSellerMember({
        actorRole: context.membership.role,
        currentRole: member.role,
        nextRole: parsed.data.role,
      });
      if (!allowed) return false;

      const result = await tx.sellerMember.updateMany({
        where: { id: member.id, sellerId: context.seller.id, role: member.role },
        data: { role: parsed.data.role },
      });
      if (result.count !== 1) return false;
      await tx.auditLog.create({
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
      return true;
    });
    if (updated) revalidatePath("/seller", "layout");
  } catch (error) {
    throw toActionError(error, "updateSellerMemberRoleAction");
  }
}

export async function removeSellerMemberAction(memberId: string): Promise<void> {
  const context = await requireSellerAccess("SELLER_MANAGE");
  const parsedMemberId = memberIdSchema.safeParse(memberId);
  if (!parsedMemberId.success) return;
  memberId = parsedMemberId.data;

  try {
    const removed = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "seller_members" WHERE id = ${memberId} AND "sellerId" = ${context.seller.id} FOR UPDATE`;
      const member = await tx.sellerMember.findFirst({ where: { id: memberId, sellerId: context.seller.id } });
      if (!member) return false;
      const allowed = canManageSellerMember({
        actorRole: context.membership.role,
        currentRole: member.role,
        nextRole: null,
      });
      if (!allowed) return false;

      const result = await tx.sellerMember.deleteMany({
        where: { id: member.id, sellerId: context.seller.id, role: member.role },
      });
      if (result.count !== 1) return false;
      await tx.auditLog.create({
        data: {
          action: "SELLER_MEMBER_REMOVED",
          entityType: "SELLER_MEMBER",
          entityId: member.id,
          actorUserId: context.session.user.id,
          metadata: { sellerId: context.seller.id, userId: member.userId, role: member.role } as Prisma.InputJsonValue,
        },
      });
      return true;
    });
    if (removed) revalidatePath("/seller", "layout");
  } catch (error) {
    throw toActionError(error, "removeSellerMemberAction");
  }
}
