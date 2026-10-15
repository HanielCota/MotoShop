import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ review: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireAdminAccess: async () => ({ user: { id: "admin" } }),
}));
vi.mock("../application/review-dispute", () => ({ reviewDispute: mocks.review }));

import { reviewDisputeAction } from "./admin-dispute-actions";

beforeEach(() => vi.resetAllMocks());

it("rejects a malformed dispute id before calling the service", async () => {
  const data = new FormData();
  data.set("decision", "RESOLVE");

  expect(await reviewDisputeAction("../x", data)).toEqual({ error: "Disputa inválida." });
  expect(mocks.review).not.toHaveBeenCalled();
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
