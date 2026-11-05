import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  txFindUnique: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logger: { error: mocks.logError, warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/database", () => ({
  db: {
    marketplaceConfiguration: { findUnique: mocks.findUnique },
    $transaction: (callback: (tx: unknown) => unknown) =>
      callback({
        marketplaceConfiguration: { findUnique: mocks.txFindUnique, update: mocks.update },
        auditLog: { create: mocks.audit },
      }),
  },
}));

import { ApplicationError } from "@/shared/errors/application-error";

import type { StoredMarketplaceLimits } from "../domain/marketplace-limits";
import { getMarketplaceLimits, updateMarketplaceLimits } from "./marketplace-limits";

const blank: StoredMarketplaceLimits = {
  productPhotoLimit: null,
  photoMaxSizeInMegabytes: null,
  returnPhotoLimit: null,
  lastUnitsThreshold: null,
  lowStockThreshold: null,
  newProductDays: null,
  sellerInviteTtlDays: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getMarketplaceLimits", () => {
  it("returns the saved limits with the blank ones filled by today's values", async () => {
    mocks.findUnique.mockResolvedValue({ ...blank, productPhotoLimit: 10 });

    const limits = await getMarketplaceLimits();

    expect(limits.productPhotoLimit).toBe(10);
    expect(limits.returnPhotoLimit).toBe(3);
  });

  it("logs a failed read and keeps today's values instead of breaking the page", async () => {
    mocks.findUnique.mockRejectedValue(new Error("database unavailable"));

    const limits = await getMarketplaceLimits();

    expect(limits.productPhotoLimit).toBe(8);
    expect(mocks.logError).toHaveBeenCalledWith(expect.objectContaining({ event: "marketplace_limits.read_failed" }));
  });
});

describe("updateMarketplaceLimits", () => {
  it("saves the limits and audits only what changed, in the same transaction", async () => {
    mocks.txFindUnique.mockResolvedValue({ ...blank });
    const next = { ...blank, lowStockThreshold: 10 };

    const result = await updateMarketplaceLimits("admin-a", next);

    expect(result).toEqual({ changed: true });
    expect(mocks.update).toHaveBeenCalledWith({ where: { key: "default" }, data: next });
    expect(mocks.audit).toHaveBeenCalledWith({
      data: {
        action: "MARKETPLACE_LIMITS_UPDATED",
        entityType: "MarketplaceConfiguration",
        entityId: "default",
        metadata: { previous: { lowStockThreshold: null }, next: { lowStockThreshold: 10 } },
        actorUserId: "admin-a",
      },
    });
  });

  it("writes nothing and audits nothing when no limit changed", async () => {
    mocks.txFindUnique.mockResolvedValue({ ...blank, newProductDays: 15 });

    const result = await updateMarketplaceLimits("admin-a", { ...blank, newProductDays: 15 });

    expect(result).toEqual({ changed: false });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("throws a CONFLICT ApplicationError when the commission was never saved", async () => {
    mocks.txFindUnique.mockResolvedValue(null);

    const save = updateMarketplaceLimits("admin-a", blank);

    await expect(save).rejects.toBeInstanceOf(ApplicationError);
    await expect(save).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
