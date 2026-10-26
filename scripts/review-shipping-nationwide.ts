/**
 * Gives every visible demo store (slug "review-*" owned by a review.* account, seller APPROVED or
 * ACTIVE) an own-shipping method that covers the whole country, when it has none. Touches only those
 * stores.
 *
 *   pnpm db:review:shipping --dry-run   lists each change and writes nothing
 *   pnpm db:review:shipping             creates the missing methods
 */
import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../src/generated/prisma/client";
import { formatMoneyInCents } from "../src/lib/format";
import { requireScriptDatabaseUrl } from "./database-guard";
import {
  NATIONWIDE_REVIEW_METHOD,
  VISIBLE_REVIEW_SELLER_WHERE,
  WHOLE_COUNTRY,
  storesMissingNationwideShipping,
} from "./review-shipping";

config({ path: ".env.local", quiet: true });

const dryRun = process.argv.includes("--dry-run");
const databaseUrl = requireScriptDatabaseUrl(process.env, "db:review:shipping");
const database = new PrismaClient({ adapter: new PrismaNeon({ connectionString: databaseUrl }) });

async function loadReviewStores() {
  const sellers = await database.seller.findMany({
    where: VISIBLE_REVIEW_SELLER_WHERE,
    select: {
      id: true,
      store: { select: { slug: true } },
      shippingMethods: { select: { postalCodeStart: true, postalCodeEnd: true, active: true } },
    },
    orderBy: { id: "asc" },
  });

  return sellers.map((seller) => {
    // The query only matches sellers with a "review-*" store, so a missing store is a bug.
    if (seller.store == null) throw new Error(`Seller ${seller.id} matched without a store`);

    return { sellerId: seller.id, storeSlug: seller.store.slug, methods: seller.shippingMethods };
  });
}

try {
  const stores = await loadReviewStores();
  const missing = storesMissingNationwideShipping(stores);
  console.log(`Demo stores visible: ${stores.length}. Without nationwide delivery: ${missing.length}.`);

  for (const store of missing) {
    console.log(
      `${dryRun ? "[dry-run] would create" : "creating"} "${NATIONWIDE_REVIEW_METHOD.name}" ` +
        `(${WHOLE_COUNTRY.postalCodeStart}-${WHOLE_COUNTRY.postalCodeEnd}, ` +
        `${formatMoneyInCents(NATIONWIDE_REVIEW_METHOD.priceInCents)}, ${NATIONWIDE_REVIEW_METHOD.estimatedDeliveryDays} dias) ` +
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
