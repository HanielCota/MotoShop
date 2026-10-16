import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: { $queryRaw: mocks.queryRaw } }));

import { isUniversalCategory } from "./universal-category";

describe("isUniversalCategory", () => {
  beforeEach(() => {
    mocks.queryRaw.mockReset();
  });

  it("walks up from the product category, so a universal parent covers its subcategories", async () => {
    mocks.queryRaw.mockResolvedValue([{ universal: true }]);

    await expect(isUniversalCategory("category-helmets")).resolves.toBe(true);

    const statement = mocks.queryRaw.mock.calls[0]?.[0] as { sql: string; values: unknown[] };
    expect(statement.sql).toContain('JOIN ancestors child ON parent.id = child."parentId"');
    expect(statement.sql).toContain("bool_or(universal)");
    expect(statement.values).toEqual(["category-helmets"]);
  });

  it("is false when no category in the chain is universal or the category does not exist", async () => {
    mocks.queryRaw.mockResolvedValueOnce([{ universal: false }]).mockResolvedValueOnce([{ universal: null }]);

    await expect(isUniversalCategory("category-brakes")).resolves.toBe(false);
    await expect(isUniversalCategory("missing")).resolves.toBe(false);
  });
});
