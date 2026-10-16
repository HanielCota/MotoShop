import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import type { SellerMemberRole } from "@/generated/prisma/enums";
import { getApplicationBaseUrl } from "@/config/get-application-base-url";
import { db } from "@/lib/database";

import { canManageSellerMember } from "../domain/member-management";
import {
  canUseSellerInvite,
  getSellerInviteExpiry,
  normalizeInviteEmail,
  SELLER_INVITE_UNAVAILABLE_MESSAGE,
} from "../domain/member-invite";

type InvitableRole = Exclude<SellerMemberRole, "OWNER">;
type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

type InviteActor = { sellerId: string; actorUserId: string; actorRole: SellerMemberRole };
type InviteAccount = { userId: string; email: string; emailVerified: boolean };
/** Pelo link (token) ou pela lista de convites da conta (id); nos dois casos vale a checagem de e-mail. */
export type SellerInviteLookup = { token: string } | { inviteId: string };

function inviteWhere(lookup: SellerInviteLookup) {
  return "token" in lookup ? { tokenHash: hashInviteToken(lookup.token) } : { id: lookup.inviteId };
}

function createInviteToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInviteToken(token) };
}

/** Só o hash fica no banco: quem lê a tabela não consegue montar o link. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getSellerInviteUrl(token: string): string {
  return `${getApplicationBaseUrl()}/convite/${token}`;
}

/**
 * Cria (ou renova) o convite da loja para o e-mail. Um convite pendente já existente recebe novo
 * papel, prazo e token; o link anterior deixa de valer. Não consulta se o e-mail tem conta.
 */
export async function createSellerMemberInvite(
  actor: InviteActor,
  input: { email: string; role: InvitableRole },
  now = new Date(),
): Promise<Result<{ inviteId: string; token: string; storeName: string }>> {
  if (!canManageSellerMember({ actorRole: actor.actorRole, currentRole: null, nextRole: input.role })) {
    return { ok: false, error: "Só o responsável pela loja pode convidar administradores." };
  }

  const email = normalizeInviteEmail(input.email);
  const { token, tokenHash } = createInviteToken();
  return db.$transaction(async (tx) => {
    const store = await tx.store.findFirst({ where: { sellerId: actor.sellerId }, select: { name: true } });
    const alreadyMember = await tx.sellerMember.findFirst({
      where: { sellerId: actor.sellerId, user: { email } },
      select: { id: true },
    });
    if (alreadyMember) return { ok: false as const, error: "Essa pessoa já faz parte da equipe." };

    const data = {
      role: input.role,
      tokenHash,
      expiresAt: getSellerInviteExpiry(now),
      invitedByUserId: actor.actorUserId,
    };
    const pending = await tx.sellerMemberInvite.findFirst({
      where: { sellerId: actor.sellerId, email, status: "PENDING" },
      select: { id: true },
    });
    const invite = pending
      ? await tx.sellerMemberInvite.update({ where: { id: pending.id }, data })
      : await tx.sellerMemberInvite.create({ data: { ...data, sellerId: actor.sellerId, email } });

    await tx.auditLog.create({
      data: {
        action: "SELLER_MEMBER_INVITED",
        entityType: "SELLER_MEMBER_INVITE",
        entityId: invite.id,
        actorUserId: actor.actorUserId,
        metadata: { sellerId: actor.sellerId, role: input.role, renewed: Boolean(pending) } as Prisma.InputJsonValue,
      },
    });
    return { ok: true as const, inviteId: invite.id, token, storeName: store?.name ?? "a loja" };
  });
}

/** Gera um novo link para um convite pendente da própria loja; o anterior, inclusive o do e-mail, para de valer. */
export async function renewSellerMemberInviteLink(
  actor: InviteActor,
  inviteId: string,
  now = new Date(),
): Promise<Result<{ token: string }>> {
  const { token, tokenHash } = createInviteToken();
  const updated = await db.sellerMemberInvite.updateMany({
    where: { id: inviteId, sellerId: actor.sellerId, status: "PENDING" },
    data: { tokenHash, expiresAt: getSellerInviteExpiry(now) },
  });
  if (updated.count !== 1) return { ok: false, error: "Este convite não está mais pendente." };
  return { ok: true, token };
}

export async function revokeSellerMemberInvite(actor: InviteActor, inviteId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const updated = await tx.sellerMemberInvite.updateMany({
      where: { id: inviteId, sellerId: actor.sellerId, status: "PENDING" },
      data: { status: "REVOKED", respondedAt: now },
    });
    if (updated.count !== 1) return false;
    await tx.auditLog.create({
      data: {
        action: "SELLER_MEMBER_INVITE_REVOKED",
        entityType: "SELLER_MEMBER_INVITE",
        entityId: inviteId,
        actorUserId: actor.actorUserId,
        metadata: { sellerId: actor.sellerId } as Prisma.InputJsonValue,
      },
    });
    return true;
  });
}

/** Convite exibido na página de aceite; `null` para qualquer caso indisponível (resposta única). */
export async function findUsableSellerInvite(token: string, account: InviteAccount, now = new Date()) {
  const invite = await db.sellerMemberInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      seller: { select: { id: true, status: true, store: { select: { name: true } } } },
    },
  });
  if (!invite || !canUseSellerInvite(invite, account, now)) return null;
  return invite;
}

/** Convites pendentes do e-mail verificado da conta, para quem ainda não tem loja. */
export async function listPendingInvitesForAccount(account: InviteAccount, now = new Date()) {
  if (!account.emailVerified) return [];
  return db.sellerMemberInvite.findMany({
    where: { email: normalizeInviteEmail(account.email), status: "PENDING", expiresAt: { gt: now } },
    select: { id: true, role: true, expiresAt: true, seller: { select: { store: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}

/**
 * Aceite do convite: confere conta, e-mail e prazo sob o lock do usuário, garante que a pessoa
 * não tem outra loja e consome o convite na mesma transação que cria o vínculo.
 */
export async function acceptSellerMemberInvite(
  lookup: SellerInviteLookup,
  account: InviteAccount,
  now = new Date(),
): Promise<Result<object>> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${account.userId} FOR UPDATE`;
    const invite = await tx.sellerMemberInvite.findUnique({ where: inviteWhere(lookup) });
    if (!invite || !canUseSellerInvite(invite, account, now)) {
      return { ok: false as const, error: SELLER_INVITE_UNAVAILABLE_MESSAGE };
    }

    const existingMembership = await tx.sellerMember.findFirst({ where: { userId: account.userId } });
    if (existingMembership) {
      return {
        ok: false as const,
        error: "Sua conta já faz parte de uma loja. Saia dela antes de aceitar outro convite.",
      };
    }

    const consumed = await tx.sellerMemberInvite.updateMany({
      where: { id: invite.id, status: "PENDING", tokenHash: invite.tokenHash },
      data: { status: "ACCEPTED", respondedAt: now, acceptedByUserId: account.userId },
    });
    if (consumed.count !== 1) return { ok: false as const, error: SELLER_INVITE_UNAVAILABLE_MESSAGE };

    const member = await tx.sellerMember.create({
      data: { sellerId: invite.sellerId, userId: account.userId, role: invite.role },
    });
    await tx.auditLog.create({
      data: {
        action: "SELLER_MEMBER_ADDED",
        entityType: "SELLER_MEMBER",
        entityId: member.id,
        actorUserId: account.userId,
        metadata: { sellerId: invite.sellerId, role: invite.role, inviteId: invite.id } as Prisma.InputJsonValue,
      },
    });
    return { ok: true as const };
  });
}

export async function declineSellerMemberInvite(lookup: SellerInviteLookup, account: InviteAccount, now = new Date()) {
  const invite = await db.sellerMemberInvite.findUnique({ where: inviteWhere(lookup) });
  if (!invite || !canUseSellerInvite(invite, account, now)) return false;
  const updated = await db.sellerMemberInvite.updateMany({
    where: { id: invite.id, status: "PENDING" },
    data: { status: "DECLINED", respondedAt: now },
  });
  return updated.count === 1;
}

/** Quem não é o responsável sai da loja por conta própria; o OWNER nunca sai por aqui. */
export async function leaveSellerStore(userId: string): Promise<Result<object>> {
  return db.$transaction(async (tx) => {
    const member = await tx.sellerMember.findFirst({ where: { userId } });
    if (!member) return { ok: false as const, error: "Sua conta não faz parte de nenhuma loja." };
    if (member.role === "OWNER") {
      return { ok: false as const, error: "O responsável pela loja não pode sair da equipe." };
    }

    const removed = await tx.sellerMember.deleteMany({ where: { id: member.id, userId, role: member.role } });
    if (removed.count !== 1) return { ok: false as const, error: "Não foi possível sair da loja. Tente de novo." };
    await tx.auditLog.create({
      data: {
        action: "SELLER_MEMBER_LEFT",
        entityType: "SELLER_MEMBER",
        entityId: member.id,
        actorUserId: userId,
        metadata: { sellerId: member.sellerId, role: member.role } as Prisma.InputJsonValue,
      },
    });
    return { ok: true as const };
  });
}
