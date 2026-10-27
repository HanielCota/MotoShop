import type { Prisma } from "../src/generated/prisma/client";

/** Block B: the old demo catalog from seed-demo-catalog.ts. */
export const DEMO_CATALOG_STORE_SLUGS: readonly string[] = ["demo-pista-norte", "demo-trilha-sul"];

/** The demo catalog's brands; they leave only when no product uses them any more. */
export const DEMO_BRAND_SLUGS: readonly string[] = ["apex-demo", "terra-demo"];

/** Block C: stores left by QA and integration test runs, listed one by one. */
export const TEST_LEFTOVER_STORE_SLUGS: readonly string[] = [
  "teste-moto-shop-mue9rsyk",
  "loja-qa-motoshop-1790615499277",
  "qa-freitas-admin-seller",
  "qa-freitas-partner-store",
  "qa-freitas-pending-store",
];

/** The two stores of one integration run (…-0 and …-1). */
export const INTEGRATION_RUN_STORE_PREFIX = "integration-749713fc-";

export function leftoverStoreWhere(): Prisma.StoreWhereInput {
  return {
    OR: [
      { slug: { in: [...DEMO_CATALOG_STORE_SLUGS, ...TEST_LEFTOVER_STORE_SLUGS] } },
      { slug: { startsWith: INTEGRATION_RUN_STORE_PREFIX } },
    ],
  };
}
