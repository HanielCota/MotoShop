import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { z } from "zod";

import { db } from "@/lib/database";

import type { storeProfileSchema } from "../schemas/store-profile";

type StoreProfileInput = z.infer<typeof storeProfileSchema>;

type StoreProfileScope = { storeId: string; sellerId: string; actorUserId: string };

const storeProfileSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  instagramUrl: true,
  youtubeUrl: true,
  whatsappUrl: true,
  facebookUrl: true,
} as const;

type StoreProfile = Prisma.StoreGetPayload<{ select: typeof storeProfileSelect }>;

export type UpdatedStoreProfile = { previousSlug: string; updatedStore: StoreProfile };

/** Updates the public store profile within the seller's tenant and audits before/after. Null when the store is not the seller's. */
export async function updateStoreProfile(
  scope: StoreProfileScope,
  input: StoreProfileInput,
): Promise<UpdatedStoreProfile | null> {
  return db.$transaction(async (tx) => {
    const store = await tx.store.findFirst({
      where: { id: scope.storeId, sellerId: scope.sellerId },
      select: storeProfileSelect,
    });
    if (!store) return null;

    const updatedStore = await tx.store.update({
      where: { id: store.id, sellerId: scope.sellerId },
      data: toStoreProfileData(input),
      select: storeProfileSelect,
    });

    await recordStoreProfileAudit(tx, scope, { previous: store, current: updatedStore });
    return { previousSlug: store.slug, updatedStore };
  });
}

function toStoreProfileData(input: StoreProfileInput) {
  return {
    name: input.name,
    slug: input.slug,
    description: input.description || null,
    instagramUrl: input.instagramUrl || null,
    youtubeUrl: input.youtubeUrl || null,
    whatsappUrl: input.whatsappUrl || null,
    facebookUrl: input.facebookUrl || null,
  };
}

async function recordStoreProfileAudit(
  tx: Prisma.TransactionClient,
  scope: StoreProfileScope,
  change: { previous: StoreProfile; current: StoreProfile },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      action: "STORE_PROFILE_UPDATED",
      entityType: "STORE",
      entityId: change.current.id,
      actorUserId: scope.actorUserId,
      metadata: {
        sellerId: scope.sellerId,
        previous: toProfileSnapshot(change.previous),
        current: toProfileSnapshot(change.current),
      } as Prisma.InputJsonValue,
    },
  });
}

function toProfileSnapshot(store: StoreProfile) {
  return {
    name: store.name,
    slug: store.slug,
    description: store.description,
    instagramUrl: store.instagramUrl,
    youtubeUrl: store.youtubeUrl,
    whatsappUrl: store.whatsappUrl,
    facebookUrl: store.facebookUrl,
  };
}
