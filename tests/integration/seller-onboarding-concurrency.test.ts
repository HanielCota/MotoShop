import { randomUUID } from "node:crypto";
import { afterAll, expect, test, vi } from "vitest";

import { cleanupFixtures, testDb } from "../support/database";

const fixture = vi.hoisted(() => ({ userId: "" }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireAuthenticatedUser: async () => ({ user: { id: fixture.userId } }),
}));

import { createSellerAction } from "../../src/modules/sellers/actions/seller-actions";

afterAll(async () => {
  await testDb.$disconnect();
});

test("simultaneous onboarding requests cannot attach one account to two sellers", async () => {
  const run = randomUUID().slice(0, 12);
  const email = `onboarding-race-${run}@example.test`;
  const slugs = [`onboarding-race-a-${run}`, `onboarding-race-b-${run}`];
  const user = await testDb.user.create({ data: { name: "Teste de concorrência", email } });
  fixture.userId = user.id;

  function form(slug: string) {
    const data = new FormData();
    data.set("storeName", `Loja ${slug}`);
    data.set("storeSlug", slug);
    data.set("originPostalCode", "01310100");
    data.set("type", "COMPANY");
    return data;
  }

  try {
    const results = await Promise.all(slugs.map((slug) => createSellerAction({}, form(slug))));
    const memberships = await testDb.sellerMember.findMany({ where: { userId: user.id } });

    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(results.filter((result) => result.error)).toHaveLength(1);
    expect(memberships).toHaveLength(1);
  } finally {
    const stores = await testDb.store.findMany({ where: { slug: { in: slugs } }, select: { sellerId: true } });
    await cleanupFixtures({
      sellerIds: stores.map((store) => store.sellerId),
      userIds: [user.id],
      emails: [email],
    });
  }
});
