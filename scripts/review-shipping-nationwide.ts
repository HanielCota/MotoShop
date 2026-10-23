/**
 * Gives every visible demo store (store slug "review-*", seller APPROVED or ACTIVE) an own-shipping
 * method that covers the whole country, when it has none. Touches only those stores.
 *
 *   pnpm db:review:shipping --dry-run   lists each change and writes nothing
 *   pnpm db:review:shipping             creates the missing methods
 */
import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../src/generated/prisma/client";
import { requireScriptDatabaseUrl } from "./database-guard";
import { NATIONWIDE_REVIEW_METHOD, WHOLE_COUNTRY, storesMissingNationwideShipping } from "./review-shipping";

config({ path: ".env.local", quiet: true });

const dryRun = process.argv.includes("--dry-run");
const databaseUrl = requireScriptDatabaseUrl(process.env, "db:review:shipping");
const database = new PrismaClient({ adapter: new PrismaNeon({ connectionString: databaseUrl }) });

async function loadReviewStores() {
  const sellers = await database.seller.findMany({
    where: { store: { slug: { startsWith: "review-" } }, status: { in: ["APPROVED", "ACTIVE"] } },
    select: {
      id: true,
      store: { select: { slug: true } },
      shippingMethods: { select: { postalCodeStart: true, postalCodeEnd: true, active: true } },
    },
    orderBy: { id: "asc" },
  });

  return sellers.map((seller) => ({
    sellerId: seller.id,
    storeSlug: seller.store?.slug ?? "(sem loja)",
    methods: seller.shippingMethods,
  }));
}

try {
  const stores = await loadReviewStores();
  const missing = storesMissingNationwideShipping(stores);
  console.log(`Demo stores visible: ${stores.length}. Without nationwide delivery: ${missing.length}.`);

  for (const store of missing) {
    console.log(
      `${dryRun ? "[dry-run] would create" : "creating"} "${NATIONWIDE_REVIEW_METHOD.name}" ` +
        `(${WHOLE_COUNTRY.postalCodeStart}-${WHOLE_COUNTRY.postalCodeEnd}, ` +
        `R$ ${(NATIONWIDE_REVIEW_METHOD.priceInCents / 100).toFixed(2)}, ${NATIONWIDE_REVIEW_METHOD.estimatedDeliveryDays} dias) ` +
        `for ${store.storeSlug}`,
    );
    if (dryRun) continue;

    await database.sellerShippingMethod.create({
      data: {
        sellerId: store.sellerId,
        name: NATIONWIDE_REVIEW_METHOD.name,
        postalCodeStart: WHOLE_COUNTRY.postalCodeStart,
        postalCodeEnd: WHOLE_COUNTRY.postalCodeEnd,
        priceInCents: NATIONWIDE_REVIEW_METHOD.priceInCents,
        estimatedDeliveryDays: NATIONWIDE_REVIEW_METHOD.estimatedDeliveryDays,
        active: true,
      },
    });
  }

  if (dryRun) console.log("Dry run: nothing was written.");
} finally {
  await database.$disconnect();
}
