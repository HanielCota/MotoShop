import { BYTES_PER_MEGABYTE } from "@/shared/storage/upload-image";

/** Limits the site applies, each one already resolved to a number. */
export type MarketplaceLimits = {
  /** Photos a product can have. */
  productPhotoLimit: number;
  /** Largest photo accepted for products, store logo and banner, and returns, in megabytes. */
  photoMaxSizeInMegabytes: number;
  /** Photos a customer can attach to one return request. */
  returnPhotoLimit: number;
  /** Units at or below which shoppers see "Últimas unidades". */
  lastUnitsThreshold: number;
  /** Units at or below which the seller dashboard counts a variant as "Estoque baixo". */
  lowStockThreshold: number;
  /** Days an approved product shows the "Novidade" badge; 0 turns the badge off. */
  newProductDays: number;
  /** Days a seller team invite stays valid after it is sent. */
  sellerInviteTtlDays: number;
};

export type MarketplaceLimitField = keyof MarketplaceLimits;

/** Limits as stored in `MarketplaceConfiguration`; null means "use the code default". */
export type StoredMarketplaceLimits = Record<MarketplaceLimitField, number | null>;

/** What the site did before the limits became configurable (Margot decisions up to 05/11/2026). */
export const MARKETPLACE_LIMIT_DEFAULTS = {
  productPhotoLimit: 8,
  photoMaxSizeInMegabytes: 5,
  returnPhotoLimit: 3,
  lastUnitsThreshold: 3,
  lowStockThreshold: 5,
  newProductDays: 30,
  sellerInviteTtlDays: 7,
} as const satisfies MarketplaceLimits;

/**
 * Accepted range of each limit, inclusive. The database has the same CHECK constraints
 * (migration 20261105150000_marketplace_limits).
 *
 * @remarks Photo size stops at 10 MB to spare the free ImageKit storage.
 */
export const MARKETPLACE_LIMIT_BOUNDS = {
  productPhotoLimit: { min: 1, max: 12 },
  photoMaxSizeInMegabytes: { min: 1, max: 10 },
  returnPhotoLimit: { min: 1, max: 5 },
  lastUnitsThreshold: { min: 1, max: 20 },
  lowStockThreshold: { min: 1, max: 50 },
  newProductDays: { min: 0, max: 90 },
  sellerInviteTtlDays: { min: 1, max: 30 },
} as const satisfies Record<MarketplaceLimitField, { min: number; max: number }>;

/** Stored fields in a fixed order, used to compare saves for the audit log. */
export const marketplaceLimitFields = [
  "productPhotoLimit",
  "photoMaxSizeInMegabytes",
  "returnPhotoLimit",
  "lastUnitsThreshold",
  "lowStockThreshold",
  "newProductDays",
  "sellerInviteTtlDays",
] as const satisfies readonly MarketplaceLimitField[];

/** Whether a value is an integer inside the accepted range of the field. */
export function isMarketplaceLimitInRange(field: MarketplaceLimitField, value: number): boolean {
  const bounds = MARKETPLACE_LIMIT_BOUNDS[field];
  return Number.isInteger(value) && value >= bounds.min && value <= bounds.max;
}

/**
 * Fills every blank limit with the code default.
 *
 * @param stored - The configuration row, or null when the marketplace has none yet.
 * @returns The limits the site applies.
 * @throws {RangeError} When a stored value is outside its range; the database constraints make
 * that impossible, so it means the schema and the code disagree.
 */
export function resolveMarketplaceLimits(stored: StoredMarketplaceLimits | null): MarketplaceLimits {
  const limits: MarketplaceLimits = { ...MARKETPLACE_LIMIT_DEFAULTS };
  if (stored == null) return limits;

  for (const field of marketplaceLimitFields) {
    const value = stored[field];
    if (value == null) continue;
    if (isMarketplaceLimitInRange(field, value) === false)
      throw new RangeError(`Stored marketplace limit ${field} is out of range: ${value}`);
    limits[field] = value;
  }
  return limits;
}

/** Photo size limit in bytes, as the storage provider and the browser check it. */
export function photoMaxSizeInBytes(limits: Pick<MarketplaceLimits, "photoMaxSizeInMegabytes">): number {
  return limits.photoMaxSizeInMegabytes * BYTES_PER_MEGABYTE;
}

/** Largest photo any configuration allows, in bytes; input schemas stop bigger files before reading the limits. */
export const PHOTO_SIZE_HARD_CAP_IN_BYTES = photoMaxSizeInBytes({
  photoMaxSizeInMegabytes: MARKETPLACE_LIMIT_BOUNDS.photoMaxSizeInMegabytes.max,
});

/** Fields whose stored value changes, with both sides, for the audit log. */
export function diffStoredMarketplaceLimits(previous: StoredMarketplaceLimits, next: StoredMarketplaceLimits) {
  const changed = marketplaceLimitFields.filter((field) => previous[field] !== next[field]);

  return {
    previous: Object.fromEntries(changed.map((field) => [field, previous[field]])),
    next: Object.fromEntries(changed.map((field) => [field, next[field]])),
    changedFields: changed,
  };
}
