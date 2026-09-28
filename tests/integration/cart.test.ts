import { randomUUID } from "node:crypto";
import { afterAll, expect, it, vi } from "vitest";
import { testDb } from "../support/database";
vi.mock("@/lib/database", async () => ({ db: (await import("../support/database")).testDb }));
vi.mock("@/modules/auth/application/authorization", () => ({ getCurrentSession: async () => null }));
import { findOrCreateActiveCart } from "@/modules/cart/infrastructure/cart-access";
const identity = { guestAccessTokenHash: `integration-${randomUUID()}` };
afterAll(async () => {
  await testDb.cart.deleteMany({ where: identity });
  await testDb.$disconnect();
});
it("creates one active cart under concurrency, and permits a new cart after conversion", async () => {
  const [first, same] = await Promise.all([findOrCreateActiveCart(identity), findOrCreateActiveCart(identity)]);
  expect(same.id).toBe(first.id);
  await testDb.cart.update({ where: { id: first.id }, data: { status: "CONVERTED" } });
  const [next, sameNext] = await Promise.all([findOrCreateActiveCart(identity), findOrCreateActiveCart(identity)]);
  expect(next.id).not.toBe(first.id);
  expect(sameNext.id).toBe(next.id);
  expect(await testDb.cart.count({ where: { ...identity, status: "ACTIVE" } })).toBe(1);
});
