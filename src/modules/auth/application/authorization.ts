import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Route } from "next";

import { env } from "@/config/env";
import { db } from "@/lib/database";
import { isConfiguredAdminEmail } from "@/modules/auth/domain/admin-emails";
import { hasSellerPermission, type SellerPermission } from "@/modules/auth/domain/seller-permissions";
import { auth } from "@/modules/auth/infrastructure/auth";
import { sellerPermissionDeniedPath } from "@/modules/sellers/domain/permission-denied";

export async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireAuthenticatedUser(nextPath: string) {
  const session = await getCurrentSession();

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}` as Route);
  }

  return session;
}

export async function requireSellerAccess(permission?: SellerPermission) {
  const session = await requireAuthenticatedUser("/seller");
  const membership = await db.sellerMember.findFirst({
    where: {
      userId: session.user.id,
      seller: { status: { in: ["APPROVED", "ACTIVE"] } },
    },
    include: { seller: { include: { store: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) return denyNonMember(session.user.id);

  if (!membership.seller.store) {
    redirect("/seller");
  }

  if (permission && !hasSellerPermission(membership.role, permission)) {
    redirect(sellerPermissionDeniedPath(permission) as Route);
  }

  return { session, membership, seller: membership.seller, store: membership.seller.store };
}

/**
 * Someone with no approved store. A member of a store still under review goes back to /seller to see
 * the application status; anyone else gets the plain 404, so the private pages are not revealed.
 */
async function denyNonMember(userId: string): Promise<never> {
  const pendingMembership = await db.sellerMember.findFirst({ where: { userId }, select: { id: true } });
  if (pendingMembership) redirect("/seller");

  notFound();
}

/** Anyone who is not an administrator, signed in or not, gets the plain 404 for every /admin address. */
export async function requireAdminAccess() {
  const session = await getCurrentSession();

  if (!session?.user.emailVerified || !isConfiguredAdminEmail(session.user.email, env.ADMIN_EMAILS)) {
    notFound();
  }

  return session;
}
