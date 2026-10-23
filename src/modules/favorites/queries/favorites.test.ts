import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), count: vi.fn(), findMany: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({
  db: { favorite: { findUnique: mocks.findUnique, count: mocks.count, findMany: mocks.findMany } },
}));

import { isProductFavorited, listFavoriteProducts } from "./favorites";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.count.mockResolvedValue(0);
  mocks.findMany.mockResolvedValue([]);
});

it("checks a favorite by the customer and product pair only", async () => {
  mocks.findUnique.mockResolvedValue({ id: "favorite-1" });

  await expect(isProductFavorited("user-1", "product-1")).resolves.toBe(true);
  expect(mocks.findUnique).toHaveBeenCalledWith(
    expect.objectContaining({ where: { userId_productId: { userId: "user-1", productId: "product-1" } } }),
  );
});

it("lists only the customer's favorites of approved products from approved or active stores", async () => {
  await listFavoriteProducts("user-1");

  const { where } = mocks.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
  expect(where).toMatchObject({
    userId: "user-1",
    product: { status: "APPROVED", seller: { status: { in: ["APPROVED", "ACTIVE"] } } },
  });
  expect(mocks.count).toHaveBeenCalledWith({ where });
});

it("caps the page size and the search term so the query stays bounded", async () => {
  // Enough favorites for a second page of 48, so page 2 is a real page and not clamped to the last.
  mocks.count.mockResolvedValue(100);
  await listFavoriteProducts("user-1", { pageSize: 500, page: 2, query: `  ${"a".repeat(150)}  ` });

  const args = mocks.findMany.mock.calls[0]?.[0] as {
    take: number;
    skip: number;
    where: { product: { OR: Array<{ name?: { contains: string } }> } };
  };
  expect(args.take).toBe(48);
  expect(args.skip).toBe(48);
  expect(args.where.product.OR[0]?.name?.contains).toHaveLength(100);
});
