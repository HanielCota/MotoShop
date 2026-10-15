import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ groupBy: vi.fn() }));
vi.mock("@/lib/database", () => ({ db: { productCompatibility: { groupBy: mocks.groupBy } } }));

import { countCompatibleProductsByFitment } from "./saved-motorcycles";

beforeEach(() => vi.clearAllMocks());

it("counts only approved products of approved or active sellers", async () => {
  mocks.groupBy.mockResolvedValue([{ motorcycleFitmentId: "fitment-1", _count: { _all: 4 } }]);

  const counts = await countCompatibleProductsByFitment(["fitment-1", "fitment-2"]);

  expect(mocks.groupBy).toHaveBeenCalledWith({
    by: ["motorcycleFitmentId"],
    where: {
      motorcycleFitmentId: { in: ["fitment-1", "fitment-2"] },
      product: { status: "APPROVED", seller: { status: { in: ["APPROVED", "ACTIVE"] } } },
    },
    _count: { _all: true },
  });
  expect(counts.get("fitment-1")).toBe(4);
  expect(counts.get("fitment-2")).toBeUndefined();
});

it("skips the query when the garage is empty", async () => {
  expect((await countCompatibleProductsByFitment([])).size).toBe(0);
  expect(mocks.groupBy).not.toHaveBeenCalled();
});
