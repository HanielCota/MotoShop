import type { Prisma } from "../src/generated/prisma/client";
import { reviewId } from "./review-seed-ids";

/**
 * How the review scripts recognise demo rows. None of these rules reads a name or a label, so the
 * demo texts can drop "(demonstração)" without the removal script losing track of what it created.
 */

/** Demo accounts: review.*@example.test. */
export const REVIEW_USER_WHERE = {
  email: { startsWith: "review.", endsWith: "@example.test" },
} satisfies Prisma.UserWhereInput;

/** Demo stores: slug "review-*" whose owner is a demo account. */
export const REVIEW_STORE_WHERE = {
  slug: { startsWith: "review-" },
  seller: { members: { some: { role: "OWNER", user: REVIEW_USER_WHERE } } },
} satisfies Prisma.StoreWhereInput;

/** Fallback brands the expanded seed creates when the database has fewer than five active brands. */
export const REVIEW_FALLBACK_BRAND_LABELS = ["Pista", "Trilha", "Areia", "Box", "Largada"] as const;

export function reviewBrandId(label: string): string {
  return reviewId("brand", label);
}

/** Demo brands: one of the deterministic fallback IDs with a "review-marca-*" slug, used by no other product. */
export function reviewBrandWhere(reviewProductIds: string[]): Prisma.BrandWhereInput {
  return {
    id: { in: REVIEW_FALLBACK_BRAND_LABELS.map(reviewBrandId) },
    slug: { startsWith: "review-marca-" },
    products: { none: { id: { notIn: reviewProductIds } } },
  } satisfies Prisma.BrandWhereInput;
}
