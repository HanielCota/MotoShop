import "server-only";

import { cache } from "react";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { logger } from "@/lib/logger";
import { ApplicationError } from "@/shared/errors/application-error";

import {
  diffStoredMarketplaceLimits,
  resolveMarketplaceLimits,
  type MarketplaceLimits,
  type StoredMarketplaceLimits,
} from "../domain/marketplace-limits";

const MARKETPLACE_CONFIGURATION_KEY = "default";

const marketplaceLimitsSelect = {
  productPhotoLimit: true,
  photoMaxSizeInMegabytes: true,
  returnPhotoLimit: true,
  lastUnitsThreshold: true,
  lowStockThreshold: true,
  newProductDays: true,
  sellerInviteTtlDays: true,
} as const satisfies Record<keyof StoredMarketplaceLimits, true>;

/** The stored limits, blank ones as null, for the Admin form. */
export async function getStoredMarketplaceLimits(): Promise<StoredMarketplaceLimits | null> {
  return db.marketplaceConfiguration.findUnique({
    where: { key: MARKETPLACE_CONFIGURATION_KEY },
    select: marketplaceLimitsSelect,
  });
}

/**
 * Reads the limits the site applies, once per request.
 *
 * @remarks A failed read logs and falls back to the code defaults: catalog, product pages, uploads
 * and invites all depend on it, so it must never take them down.
 * @returns Every limit, blank ones filled by the code default.
 */
export const getMarketplaceLimits = cache(async (): Promise<MarketplaceLimits> => {
  try {
    return resolveMarketplaceLimits(await getStoredMarketplaceLimits());
  } catch (error) {
    logger.error({ event: "marketplace_limits.read_failed", error });
    return resolveMarketplaceLimits(null);
  }
});

/**
 * Saves the limits and records what changed in the audit log, in one transaction.
 *
 * @param actorUserId - Admin who saved the form.
 * @param limits - Validated values; null means "use the code default".
 * @returns Whether any stored value changed (no audit entry when nothing did).
 * @throws {ApplicationError} CONFLICT when the marketplace configuration row does not exist yet: it
 * also holds the default commission, which the admin must set first.
 */
export async function updateMarketplaceLimits(actorUserId: string, limits: StoredMarketplaceLimits) {
  return db.$transaction(
    async (tx) => {
      const previous = await tx.marketplaceConfiguration.findUnique({
        where: { key: MARKETPLACE_CONFIGURATION_KEY },
        select: marketplaceLimitsSelect,
      });
      if (previous == null)
        throw new ApplicationError({
          code: "CONFLICT",
          statusCode: 409,
          message: "Salve a comissão padrão antes de mudar os limites.",
        });

      const changes = diffStoredMarketplaceLimits(previous, limits);
      if (changes.changedFields.length === 0) return { changed: false };

      await tx.marketplaceConfiguration.update({ where: { key: MARKETPLACE_CONFIGURATION_KEY }, data: limits });
      await tx.auditLog.create({
        data: {
          action: "MARKETPLACE_LIMITS_UPDATED",
          entityType: "MarketplaceConfiguration",
          entityId: MARKETPLACE_CONFIGURATION_KEY,
          metadata: { previous: changes.previous, next: changes.next } as Prisma.InputJsonValue,
          actorUserId,
        },
      });
      return { changed: true };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
