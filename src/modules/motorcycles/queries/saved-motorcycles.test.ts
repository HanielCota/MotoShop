import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock("@/lib/database", () => ({ db: { $queryRaw: mocks.queryRaw } }));

import { countCompatibleProductsByFitment } from "./saved-motorcycles";

beforeEach(() => vi.clearAllMocks());

function sqlText(): string {
  const [query] = mocks.queryRaw.mock.calls[0] ?? [];
  return (query as { strings: string[] }).strings.join("?");
}

it("counts, per fitment, the catalog products confirmed for it or in a universal category", async () => {
  mocks.queryRaw.mockResolvedValue([{ fitmentId: "fitment-1", total: BigInt(4) }]);

  const counts = await countCompatibleProductsByFitment(["fitment-1", "fitment-2"]);

  expect(counts.get("fitment-1")).toBe(4);
  expect(counts.get("fitment-2")).toBeUndefined();
  expect(sqlText()).toContain("universal_categories");
  expect(sqlText()).toContain("p.status = 'APPROVED'");
  expect(sqlText()).toContain("s.status IN ('APPROVED', 'ACTIVE')");
});

it("skips the query when the garage is empty", async () => {
  expect((await countCompatibleProductsByFitment([])).size).toBe(0);
  expect(mocks.queryRaw).not.toHaveBeenCalled();
});
