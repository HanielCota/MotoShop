import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { ApplicationError } from "@/shared/errors/application-error";

export type SetCouponParticipationInput = {
  sellerId: string;
  userId: string;
  couponId: string;
  participate: boolean;
};

type Campaign = { id: string; code: string; active: boolean; endsAt: Date | null };
type Participation = { id: string; leftAt: Date | null } | null;

/**
 * A seller joins or leaves a Moto Shop campaign (marketplace coupon paid for by the seller).
 * The change only affects later checkouts: the coupon row is locked and its `updatedAt` bumped,
 * so a checkout computed before the change fails its locked recheck instead of using stale data.
 */
export async function setCouponParticipation(input: SetCouponParticipationInput): Promise<{ changed: boolean }> {
  return db.$transaction(async (tx) => {
    const now = new Date();
    const campaign = await lockCampaign(tx, input.couponId);
    if (input.participate) assertCampaignOpen(campaign, now);

    const participation = await tx.couponSellerParticipation.findUnique({
      where: { couponId_sellerId: { couponId: campaign.id, sellerId: input.sellerId } },
      select: { id: true, leftAt: true },
    });
    const changed = input.participate
      ? await join(tx, { campaign, sellerId: input.sellerId, participation, now })
      : await leave(tx, { participation, now });
    if (!changed) return { changed };

    await tx.coupon.update({ where: { id: campaign.id }, data: { updatedAt: now } });
    await recordParticipationAudit(tx, { campaign, input });
    return { changed };
  });
}

async function lockCampaign(tx: Prisma.TransactionClient, couponId: string): Promise<Campaign> {
  await tx.$queryRaw`SELECT id FROM "coupons" WHERE id = ${couponId} FOR UPDATE`;
  const campaign = await tx.coupon.findFirst({
    where: { id: couponId, ownerType: "MARKETPLACE", fundedBy: "SELLER" },
    select: { id: true, code: true, active: true, endsAt: true },
  });
  if (!campaign)
    throw new ApplicationError({ code: "NOT_FOUND", message: "Campanha não encontrada.", statusCode: 404 });
  return campaign;
}

function assertCampaignOpen(campaign: Campaign, now: Date): void {
  if (campaign.active && (campaign.endsAt === null || campaign.endsAt >= now)) return;

  throw new ApplicationError({
    code: "CONFLICT",
    message: "Esta campanha não está mais disponível para adesão.",
    statusCode: 409,
  });
}

async function join(
  tx: Prisma.TransactionClient,
  input: { campaign: Campaign; sellerId: string; participation: Participation; now: Date },
): Promise<boolean> {
  const { campaign, sellerId, participation, now } = input;
  if (participation && participation.leftAt === null) return false;

  if (participation) {
    await tx.couponSellerParticipation.update({
      where: { id: participation.id },
      data: { joinedAt: now, leftAt: null },
    });
    return true;
  }

  await tx.couponSellerParticipation.create({ data: { couponId: campaign.id, sellerId, joinedAt: now } });
  return true;
}

async function leave(
  tx: Prisma.TransactionClient,
  input: { participation: Participation; now: Date },
): Promise<boolean> {
  const { participation, now } = input;
  if (!participation || participation.leftAt !== null) return false;

  await tx.couponSellerParticipation.update({ where: { id: participation.id }, data: { leftAt: now } });
  return true;
}

async function recordParticipationAudit(
  tx: Prisma.TransactionClient,
  entry: { campaign: Campaign; input: SetCouponParticipationInput },
): Promise<void> {
  const { campaign, input } = entry;
  await tx.auditLog.create({
    data: {
      action: input.participate ? "COUPON_CAMPAIGN_JOINED" : "COUPON_CAMPAIGN_LEFT",
      entityType: "Coupon",
      entityId: campaign.id,
      actorUserId: input.userId,
      metadata: { code: campaign.code, sellerId: input.sellerId },
    },
  });
}
