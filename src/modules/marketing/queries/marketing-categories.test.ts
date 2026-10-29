import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: { category: { findMany: mocks.findMany } } }));

import { listMarketingCategories } from "./marketing-categories";

it("lists the active categories in the order the Admin sets, then by name", async () => {
  mocks.findMany.mockResolvedValue([]);

  await listMarketingCategories();

  expect(mocks.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  );
});
