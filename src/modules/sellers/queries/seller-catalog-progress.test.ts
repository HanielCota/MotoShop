import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ groupBy: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: { product: { groupBy: mocks.groupBy } } }));

import { getSellerCatalogProgress } from "./seller-catalog-progress";

beforeEach(() => vi.clearAllMocks());

describe("getSellerCatalogProgress", () => {
  it("counts only products belonging to the requested seller", async () => {
    mocks.groupBy.mockResolvedValue([
      { status: "DRAFT", _count: { _all: 2 } },
      { status: "REJECTED", _count: { _all: 1 } },
      { status: "SUBMITTED", _count: { _all: 1 } },
    ]);

    const result = await getSellerCatalogProgress("seller-a");

    expect(result).toEqual({ editable: 3, submitted: 1, approved: 0 });
    expect(mocks.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ sellerId: "seller-a" }) }),
    );
  });
});
