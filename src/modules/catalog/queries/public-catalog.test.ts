import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findStore: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: { store: { findFirst: mocks.findStore } } }));
vi.mock("@/shared/storage/public-storage-url", () => ({ getPublicStorageUrl: vi.fn() }));

import { getPublicStoreBySlug, isPublicStoreSlug } from "./public-catalog";

const publicStoreWhere = { slug: "areia-motos", seller: { status: { in: ["APPROVED", "ACTIVE"] } } };

beforeEach(() => {
  mocks.findStore.mockReset();
});

it("finds a public store only among approved or active sellers", async () => {
  mocks.findStore.mockResolvedValue({ id: "store-1" });

  const isPublic = await isPublicStoreSlug("areia-motos");

  expect(isPublic).toBe(true);
  expect(mocks.findStore).toHaveBeenCalledWith({ where: publicStoreWhere, select: { id: true } });
});

it("says a store is not public when no approved or active seller owns that slug", async () => {
  mocks.findStore.mockResolvedValue(null);

  await expect(isPublicStoreSlug("loja-suspensa")).resolves.toBe(false);
});

it("loads the full store page with the same seller rule as the check", async () => {
  mocks.findStore.mockResolvedValue(null);

  await getPublicStoreBySlug("areia-motos");

  expect(mocks.findStore).toHaveBeenCalledWith(expect.objectContaining({ where: publicStoreWhere }));
});
