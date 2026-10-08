import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  product: vi.fn(),
  favorite: vi.fn(),
  deleteMany: vi.fn(),
  create: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireAuthenticatedUser: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/database", () => ({
  db: {
    product: { findUnique: mocks.product },
    favorite: { findUnique: mocks.favorite, deleteMany: mocks.deleteMany, create: mocks.create },
  },
}));

import { toggleFavoriteAction } from "./favorite-actions";

const productId = "cjld2cjxh0000qzrmn831i7rn";

beforeEach(() => {
  mocks.product.mockReset();
  mocks.favorite.mockReset();
  mocks.deleteMany.mockReset();
  mocks.create.mockReset();
});

describe("toggleFavoriteAction", () => {
  it("removes a favorite even when the product is no longer approved", async () => {
    mocks.product.mockResolvedValue({ id: productId, slug: "p", status: "ARCHIVED" });
    mocks.favorite.mockResolvedValue({ id: "fav-1" });
    await expect(toggleFavoriteAction(productId)).resolves.toEqual({ isFavorite: false });
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: "fav-1", userId: "user-1" } });
  });

  it("does not add a favorite for a product that is not approved", async () => {
    mocks.product.mockResolvedValue({ id: productId, slug: "p", status: "PAUSED" });
    mocks.favorite.mockResolvedValue(null);
    await expect(toggleFavoriteAction(productId)).resolves.toHaveProperty("error");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("adds a favorite for an approved product", async () => {
    mocks.product.mockResolvedValue({ id: productId, slug: "p", status: "APPROVED" });
    mocks.favorite.mockResolvedValue(null);
    await expect(toggleFavoriteAction(productId)).resolves.toEqual({ isFavorite: true });
  });
});
