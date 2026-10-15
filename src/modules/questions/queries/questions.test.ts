import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ count: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/database", () => ({ db: { productQuestion: { count: mocks.count, findMany: mocks.findMany } } }));

import { listSellerQuestions } from "./questions";

beforeEach(() => {
  mocks.count.mockResolvedValue(0);
  mocks.findMany.mockResolvedValue([]);
});

it("matches the asker e-mail only exactly and never selects it (L-18)", async () => {
  await listSellerQuestions("seller-a", { q: "carla@" });

  const query = mocks.findMany.mock.calls[0]?.[0];
  expect(query.where.sellerId).toBe("seller-a");
  expect(query.where.OR).toContainEqual({ askedBy: { email: { equals: "carla@", mode: "insensitive" } } });
  expect(query.include.askedBy).toEqual({ select: { name: true } });
});
