import type { Prisma } from "../src/generated/prisma/client";
import { parseEmailList } from "./review-seed-ids";

/**
 * What no demo removal script may delete, even when a filter would reach it. The real e-mails stay
 * out of the code: they come from DEMO_REMOVAL_PROTECTED_EMAILS in .env.local.
 */

/** The client's store and our own store for the photo test. */
export const PROTECTED_STORE_SLUGS: readonly string[] = ["luiz-parts", "loja-teste"];

const TEST_EMAIL_DOMAIN = "@example.test";

export type DemoRemovalProtection = { emails: readonly string[] };

export type StoreInScope = { slug: string; memberEmails: readonly string[] };

export class ProtectedDataError extends Error {
  override name = "ProtectedDataError";
}

/** Fails early when the protected e-mails are not configured, so a run never goes unguarded. */
export function readDemoRemovalProtection(
  environment: Readonly<Record<string, string | undefined>>,
): DemoRemovalProtection {
  const emails = parseEmailList(environment.DEMO_REMOVAL_PROTECTED_EMAILS);
  if (emails.length === 0)
    throw new ProtectedDataError("DEMO_REMOVAL_PROTECTED_EMAILS is required: list the accounts that must stay.");

  return { emails };
}

export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");

  return `${local.slice(0, 2)}***@${domain}`;
}

export function isProtectedEmail(protection: DemoRemovalProtection, email: string): boolean {
  return protection.emails.includes(email.trim().toLowerCase());
}

export function isTestEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(TEST_EMAIL_DOMAIN);
}

/** Refuses the whole run when a protected store or account is about to be deleted. */
export function assertNothingProtected(
  protection: DemoRemovalProtection,
  scope: { stores: readonly StoreInScope[]; deletedUserEmails: readonly string[] },
): void {
  const protectedStore = scope.stores.find((store) => PROTECTED_STORE_SLUGS.includes(store.slug));
  if (protectedStore != null)
    throw new ProtectedDataError(`Protected store in the removal scope: ${protectedStore.slug}. Aborting.`);

  const protectedUser = scope.deletedUserEmails
    .map((email) => email.trim().toLowerCase())
    .find((email) => isProtectedEmail(protection, email));
  if (protectedUser != null)
    throw new ProtectedDataError(`Protected account in the removal scope: ${maskEmail(protectedUser)}. Aborting.`);
}

/** Stores with a real (non-test) member: they leave only when the owner confirms each one by slug. */
export function storesNeedingConfirmation(stores: readonly StoreInScope[]): StoreInScope[] {
  return stores.filter((store) => store.memberEmails.some((email) => isTestEmail(email) === false));
}

export function assertStoresConfirmed(stores: readonly StoreInScope[], confirmedSlugs: readonly string[]): void {
  const missing = storesNeedingConfirmation(stores).filter((store) => confirmedSlugs.includes(store.slug) === false);
  if (missing.length === 0) return;

  throw new ProtectedDataError(
    `Stores with real members need --confirm-stores: ${missing.map((store) => store.slug).join(", ")}. Aborting.`,
  );
}

/** `--confirm-stores=a,b` from the command line. */
export function parseConfirmedStores(argv: readonly string[]): string[] {
  const argument = argv.find((value) => value.startsWith("--confirm-stores="));
  if (argument == null) return [];

  return argument
    .slice("--confirm-stores=".length)
    .split(",")
    .map((slug) => slug.trim())
    .filter((slug) => slug.length > 0);
}

export async function findProtectedUserIds(
  tx: Prisma.TransactionClient,
  protection: DemoRemovalProtection,
): Promise<string[]> {
  const users = await tx.user.findMany({ select: { id: true, email: true } });

  return users.filter((user) => isProtectedEmail(protection, user.email)).map((user) => user.id);
}

/** Rows of protected accounts that point at the scope: they leave with the demo items, so the report shows them. */
export async function countProtectedAccountRows(
  tx: Prisma.TransactionClient,
  scope: { protectedUserIds: string[]; sellerIds: string[]; productIds: string[]; orderIds: string[] },
): Promise<Record<string, number>> {
  const owned = { in: scope.protectedUserIds };
  const sellers = { in: scope.sellerIds };

  return {
    cartItems: await tx.cartItem.count({ where: { cart: { userId: owned }, variant: { sellerId: sellers } } }),
    favorites: await tx.favorite.count({ where: { userId: owned, productId: { in: scope.productIds } } }),
    questions: await tx.productQuestion.count({ where: { askedByUserId: owned, sellerId: sellers } }),
    productReviews: await tx.productReview.count({ where: { userId: owned, sellerId: sellers } }),
    sellerReviews: await tx.sellerReview.count({ where: { userId: owned, sellerId: sellers } }),
    orders: await tx.order.count({ where: { userId: owned, id: { in: scope.orderIds } } }),
  };
}

/** The masked view of a store for the dry-run report. */
export function describeStore(store: StoreInScope): { slug: string; members: string[] } {
  return { slug: store.slug, members: store.memberEmails.map(maskEmail) };
}
