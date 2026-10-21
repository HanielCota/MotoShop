import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { cleanupFixtures, testDb } from "../support/database";
import { must } from "../support/must";

vi.mock("@/lib/database", async () => ({ db: (await import("../support/database")).testDb }));

import {
  addSavedMotorcycle,
  changeSavedMotorcycle,
  removeSavedMotorcycle,
  setPrimarySavedMotorcycle,
} from "@/modules/motorcycles/application/saved-motorcycles";
import {
  countCompatibleProductsByFitment,
  getPrimarySavedMotorcycle,
  listSavedMotorcycles,
} from "@/modules/motorcycles/queries/saved-motorcycles";

const run = randomUUID().slice(0, 8);
const emails = [`garage-${run}-a@example.test`, `garage-${run}-b@example.test`];
const userIds: string[] = [];
let fitmentIds: string[] = [];

beforeAll(async () => {
  const fitments = await testDb.motorcycleFitment.findMany({
    where: { motorcycleModel: { active: true, manufacturer: { active: true } } },
    select: { id: true },
    take: 3,
  });
  if (fitments.length < 3) throw new Error("A base de testes precisa ter três configurações de motos ativas.");
  fitmentIds = fitments.map((fitment) => fitment.id);
  for (const email of emails) {
    const user = await testDb.user.create({ data: { name: "Garagem teste", email } });
    userIds.push(user.id);
  }
});

afterAll(async () => {
  if (userIds.length) {
    await testDb.user.deleteMany({ where: { id: { in: userIds }, email: { in: emails } } });
  }
  await testDb.$disconnect();
});

describe("garagem pessoal", () => {
  it("salva, edita e promove uma moto principal sem misturar usuários", async () => {
    const [ownerId, otherId] = userIds;
    const [firstFitmentId, secondFitmentId, thirdFitmentId] = fitmentIds;
    expect(ownerId && otherId && firstFitmentId && secondFitmentId && thirdFitmentId).toBeTruthy();
    if (!ownerId || !otherId || !firstFitmentId || !secondFitmentId || !thirdFitmentId) return;

    await expect(addSavedMotorcycle(ownerId, "unknown-fitment", false)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await addSavedMotorcycle(ownerId, firstFitmentId, false);
    await addSavedMotorcycle(ownerId, secondFitmentId, false);
    await expect(addSavedMotorcycle(ownerId, firstFitmentId, false)).rejects.toMatchObject({ code: "CONFLICT" });

    let mine = await listSavedMotorcycles(ownerId);
    expect(mine).toHaveLength(2);
    expect(mine.filter((motorcycle) => motorcycle.isPrimary)).toHaveLength(1);
    expect((await getPrimarySavedMotorcycle(ownerId))?.motorcycleFitmentId).toBe(firstFitmentId);
    expect(await listSavedMotorcycles(otherId)).toHaveLength(0);
    const first = must(
      mine.find((motorcycle) => motorcycle.motorcycleFitmentId === firstFitmentId),
      "first saved motorcycle",
    );
    const second = must(
      mine.find((motorcycle) => motorcycle.motorcycleFitmentId === secondFitmentId),
      "second saved motorcycle",
    );

    await expect(changeSavedMotorcycle(otherId, first.id, thirdFitmentId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setPrimarySavedMotorcycle(otherId, second.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(removeSavedMotorcycle(otherId, first.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(changeSavedMotorcycle(ownerId, first.id, secondFitmentId)).rejects.toMatchObject({ code: "P2002" });

    await changeSavedMotorcycle(ownerId, first.id, thirdFitmentId);
    await setPrimarySavedMotorcycle(ownerId, second.id);
    mine = await listSavedMotorcycles(ownerId);
    expect(mine.find((motorcycle) => motorcycle.id === first.id)?.motorcycleFitmentId).toBe(thirdFitmentId);
    expect(mine.filter((motorcycle) => motorcycle.isPrimary).map((motorcycle) => motorcycle.id)).toEqual([second.id]);

    await removeSavedMotorcycle(ownerId, second.id);
    expect((await getPrimarySavedMotorcycle(ownerId))?.motorcycleFitmentId).toBe(thirdFitmentId);
    await removeSavedMotorcycle(ownerId, first.id);
    expect(await listSavedMotorcycles(ownerId)).toHaveLength(0);
    expect(await getPrimarySavedMotorcycle(ownerId)).toBeNull();
  });
});

// Regression: the garage counted only products with a compatibility row, so a motorcycle whose only
// products are in a universal category showed "Não encontramos nenhum equipamento" and no
// "Ver peças compatíveis", while the catalog listed those products for it.
describe("contagem de peças da garagem", () => {
  const sellerIds: string[] = [];
  const categoryIds: string[] = [];

  afterAll(async () => {
    await cleanupFixtures({ sellerIds, userIds: [], emails: [] });
    await testDb.category.deleteMany({ where: { id: { in: categoryIds } } });
  });

  it("counts a product of a universal category for any motorcycle once it has an active variant", async () => {
    const fitmentId = must(fitmentIds[0], "fitment");
    const brand = await testDb.brand.findFirstOrThrow({ where: { active: true } });
    const category = await testDb.category.create({
      data: { name: `Universal ${run}`, slug: `universal-${run}`, active: true, universal: true },
    });
    categoryIds.push(category.id);
    const seller = await testDb.seller.create({
      data: {
        type: "INDIVIDUAL",
        status: "ACTIVE",
        store: { create: { name: `Garagem ${run}`, slug: `garagem-${run}` } },
      },
      include: { store: true },
    });
    sellerIds.push(seller.id);
    const before = (await countCompatibleProductsByFitment([fitmentId])).get(fitmentId) ?? 0;

    const product = await testDb.product.create({
      data: {
        name: `Capacete ${run}`,
        slug: `capacete-${run}`,
        description: "Temporary test fixture",
        status: "APPROVED",
        sellerId: seller.id,
        storeId: must(seller.store, "seller store").id,
        categoryId: category.id,
        brandId: brand.id,
      },
    });

    // Like the catalog, a product without an active variant is not listed, so it is not counted.
    const withoutVariant = (await countCompatibleProductsByFitment([fitmentId])).get(fitmentId) ?? 0;
    expect(withoutVariant).toBe(before);

    await testDb.productVariant.create({
      data: { sku: `CAP-${run}`, title: "Único", priceInCents: 19_900, productId: product.id, sellerId: seller.id },
    });

    const after = (await countCompatibleProductsByFitment([fitmentId])).get(fitmentId) ?? 0;
    expect(after - before).toBe(1);
  });
});
