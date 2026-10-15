import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Route } from "next";

import { env } from "@/config/env";
import { db } from "@/lib/database";
import { isConfiguredAdminEmail } from "@/modules/auth/domain/admin-emails";
import { hasSellerPermission, type SellerPermission } from "@/modules/auth/domain/seller-permissions";
import { auth } from "@/modules/auth/infrastructure/auth";

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

  if (!membership?.seller.store) {
    redirect("/seller");
  }

  if (permission && !hasSellerPermission(membership.role, permission)) {
    redirect("/seller?error=permission");
  }

  return { session, membership, seller: membership.seller, store: membership.seller.store };
}

export async function requireAdminAccess() {
  const session = await requireAuthenticatedUser("/admin");

  if (!session.user.emailVerified || !isConfiguredAdminEmail(session.user.email, env.ADMIN_EMAILS)) {
    redirect("/forbidden" as Route);
  }

  return session;
}
