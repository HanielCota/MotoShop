import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ count: vi.fn(), findMany: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: { favorite: { count: mocks.count, findMany: mocks.findMany } } }));

import { listFavoriteProducts } from "./favorites";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findMany.mockResolvedValue([]);
});

// Regression: with 3 favorites, ?favoritePage=3 showed "Nenhum favorito ainda" because the items of
// page 3 were read before knowing there is only one page. Like the catalog, it now shows the last page.
it("shows the last page instead of an empty list when the page asked for is past the end", async () => {
  mocks.count.mockResolvedValue(3);

  const result = await listFavoriteProducts("user-1", { page: 3, pageSize: 12 });

  expect(result).toMatchObject({ total: 3, page: 1, pageCount: 1 });
  expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 12 }));
});

it("keeps a page that exists and reads its items", async () => {
  mocks.count.mockResolvedValue(30);

  const result = await listFavoriteProducts("user-1", { page: 2, pageSize: 12 });

  expect(result).toMatchObject({ total: 30, page: 2, pageCount: 3 });
  expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 12, take: 12 }));
});

it("never builds a huge offset from an absurd page number in the URL", async () => {
  mocks.count.mockResolvedValue(30);

  await listFavoriteProducts("user-1", { page: 1e20, pageSize: 12 });

  expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 24 }));
});
