import "server-only";

import { addMonths } from "date-fns";
import type { Prisma } from "@/generated/prisma/client";

import { db } from "@/lib/database";
import { ApplicationError } from "@/shared/errors/application-error";

type VipSubscriptionInput = { sellerId: string; months: number };

type VipPeriod = { sellerId: string; months: number; startsAt: Date; endsAt: Date };

/** Activates the VIP plan, or extends the current active one, under a lock on the seller row. */
export async function activateVipSubscription(actorUserId: string, input: VipSubscriptionInput): Promise<void> {
  const now = new Date();

  await db.$transaction(async (tx) => {
    const sellerId = await lockApprovedSeller(tx, input.sellerId);
    const activeSubscription = await findActiveSubscription(tx, sellerId, now);
    const startsAt = activeSubscription?.startsAt ?? now;
    const baseEnd = activeSubscription && activeSubscription.endsAt > now ? activeSubscription.endsAt : now;
    const period = { sellerId, months: input.months, startsAt, endsAt: addMonths(baseEnd, input.months) };

    if (activeSubscription) {
      await tx.sellerSubscription.update({ where: { id: activeSubscription.id }, data: { endsAt: period.endsAt } });
      await recordVipAudit(
        tx,
        { action: "SELLER_VIP_RENEWED", subscriptionId: activeSubscription.id, actorUserId },
        period,
      );
      return;
    }

    const subscription = await tx.sellerSubscription.create({
      data: { sellerId, startsAt, endsAt: period.endsAt, plan: "VIP", status: "ACTIVE" },
    });
    await recordVipAudit(tx, { action: "SELLER_VIP_ACTIVATED", subscriptionId: subscription.id, actorUserId }, period);
  });
}

async function lockApprovedSeller(tx: Prisma.TransactionClient, sellerId: string): Promise<string> {
  await tx.$queryRaw`SELECT id FROM "sellers" WHERE id = ${sellerId} FOR UPDATE`;
  const seller = await tx.seller.findFirst({
    where: { id: sellerId, status: { in: ["APPROVED", "ACTIVE"] } },
  });
  if (!seller) throw new ApplicationError({ code: "CONFLICT", message: "Loja não encontrada ou ainda não aprovada." });

  return seller.id;
}

async function findActiveSubscription(tx: Prisma.TransactionClient, sellerId: string, now: Date) {
  return tx.sellerSubscription.findFirst({
    where: {
      sellerId,
      status: "ACTIVE",
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    orderBy: { endsAt: "desc" },
  });
}

async function recordVipAudit(
  tx: Prisma.TransactionClient,
  entry: { action: "SELLER_VIP_RENEWED" | "SELLER_VIP_ACTIVATED"; subscriptionId: string; actorUserId: string },
  period: VipPeriod,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      action: entry.action,
      entityType: "SELLER_SUBSCRIPTION",
      entityId: entry.subscriptionId,
      actorUserId: entry.actorUserId,
      metadata: {
        sellerId: period.sellerId,
        months: period.months,
        startsAt: period.startsAt.toISOString(),
        endsAt: period.endsAt.toISOString(),
      } as Prisma.InputJsonValue,
    },
  });
}
