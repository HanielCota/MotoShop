import { describe, expect, it } from "vitest";

import {
  diffStoredMarketplaceLimits,
  isMarketplaceLimitInRange,
  MARKETPLACE_LIMIT_DEFAULTS,
  photoMaxSizeInBytes,
  resolveMarketplaceLimits,
  type StoredMarketplaceLimits,
} from "./marketplace-limits";

const blank: StoredMarketplaceLimits = {
  productPhotoLimit: null,
  photoMaxSizeInMegabytes: null,
  returnPhotoLimit: null,
  lastUnitsThreshold: null,
  lowStockThreshold: null,
  newProductDays: null,
  sellerInviteTtlDays: null,
};

describe("resolveMarketplaceLimits", () => {
  it("uses today's values when the marketplace has no configuration row", () => {
    const limits = resolveMarketplaceLimits(null);

    expect(limits).toEqual({
      productPhotoLimit: 8,
      photoMaxSizeInMegabytes: 5,
      returnPhotoLimit: 3,
      lastUnitsThreshold: 3,
      lowStockThreshold: 5,
      newProductDays: 30,
      sellerInviteTtlDays: 7,
    });
  });

  it("keeps the saved values and fills only the blank ones with the default", () => {
    const limits = resolveMarketplaceLimits({ ...blank, productPhotoLimit: 12, newProductDays: 0 });

    expect(limits.productPhotoLimit).toBe(12);
    expect(limits.newProductDays).toBe(0);
    expect(limits.returnPhotoLimit).toBe(MARKETPLACE_LIMIT_DEFAULTS.returnPhotoLimit);
  });

  it("throws RangeError when a stored value is outside its range", () => {
    expect(() => resolveMarketplaceLimits({ ...blank, photoMaxSizeInMegabytes: 50 })).toThrow(RangeError);
  });
});

describe("isMarketplaceLimitInRange", () => {
  it.each([
    ["productPhotoLimit", 1, true],
    ["productPhotoLimit", 12, true],
    ["productPhotoLimit", 0, false],
    ["productPhotoLimit", 13, false],
    ["newProductDays", 0, true],
    ["newProductDays", -1, false],
    ["sellerInviteTtlDays", 2.5, false],
    ["lowStockThreshold", Number.NaN, false],
    ["lowStockThreshold", Number.POSITIVE_INFINITY, false],
  ] as const)("%s = %d is %s", (field, value, expected) => {
    const result = isMarketplaceLimitInRange(field, value);

    expect(result).toBe(expected);
  });
});

describe("photoMaxSizeInBytes", () => {
  it("converts megabytes to the bytes the storage provider checks", () => {
    const bytes = photoMaxSizeInBytes({ photoMaxSizeInMegabytes: 5 });

    expect(bytes).toBe(5 * 1024 * 1024);
  });
});

describe("diffStoredMarketplaceLimits", () => {
  it("lists only the fields that changed, with both sides", () => {
    const changes = diffStoredMarketplaceLimits(blank, { ...blank, returnPhotoLimit: 5 });

    expect(changes).toEqual({
      previous: { returnPhotoLimit: null },
      next: { returnPhotoLimit: 5 },
      changedFields: ["returnPhotoLimit"],
    });
  });
});
