import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { testDb } from "../support/database";

vi.mock("@/lib/database", async () => ({ db: (await import("../support/database")).testDb }));

import { createCoupon } from "@/modules/coupons/application/create-coupon";

const run = randomUUID().slice(0, 8).toUpperCase();
const email = `campaign-${run.toLowerCase()}@example.test`;
const codes = [`CAMP-${run}`, `NOSELLER-${run}`];
let userId = "";

beforeAll(async () => {
  userId = (await testDb.user.create({ data: { name: "Admin campanha teste", email } })).id;
});

afterAll(async () => {
  const coupons = await testDb.coupon.findMany({ where: { code: { in: codes } }, select: { id: true } });
  const couponIds = coupons.map((coupon) => coupon.id);
  await testDb.auditLog.deleteMany({ where: { entityType: "Coupon", entityId: { in: couponIds } } });
  await testDb.coupon.deleteMany({ where: { id: { in: couponIds } } });
  await testDb.user.deleteMany({ where: { id: userId, email } });
  await testDb.$disconnect();
});

// Regression: coupons_funding_check rejected "Campanha com adesão" (MARKETPLACE owner, sellerId NULL,
// paid by the sellers that join) until migration 20261013180000.
it("creates a seller-funded Moto Shop campaign without a seller", async () => {
  await createCoupon(
    { ownerType: "MARKETPLACE", fundedBy: "SELLER", actorUserId: userId },
    { code: codes[0] ?? "", discountType: "PERCENTAGE", percentageBps: 800, minimumPurchaseInCents: 0 },
    { percentageBps: 800 },
  );

  const coupon = await testDb.coupon.findUniqueOrThrow({ where: { code: codes[0] ?? "" } });
  expect(coupon).toMatchObject({ ownerType: "MARKETPLACE", fundedBy: "SELLER", sellerId: null });
});

it("still requires a seller on store coupons (coupons_owner_check)", async () => {
  await expect(
    testDb.coupon.create({
      data: {
        code: codes[1] ?? "",
        ownerType: "SELLER",
        discountType: "PERCENTAGE",
        percentageBps: 500,
        fundedBy: "SELLER",
      },
    }),
  ).rejects.toThrow();
});
