import "server-only";

import { env } from "@/config/env";
import { db } from "@/lib/database";
import { isConfiguredAdminEmail } from "@/modules/auth/domain/admin-emails";
import type { AccountAreaAccess } from "@/modules/auth/domain/account-area-shortcuts";

type AccountUser = { id: string; email: string; emailVerified: boolean };

/**
 * Same rules the areas apply on entry: an administrator has a verified e-mail in ADMIN_EMAILS, and a
 * seller member belongs to an approved or active seller that already has a store. A pending member
 * gets no shortcut, since the Central would only send them back to the sign-up page.
 */
export async function getAccountAreaAccess(user: AccountUser): Promise<AccountAreaAccess> {
  const admin = user.emailVerified && isConfiguredAdminEmail(user.email, env.ADMIN_EMAILS);
  const membership = await db.sellerMember.findFirst({
    where: {
      userId: user.id,
      seller: { status: { in: ["APPROVED", "ACTIVE"] }, store: { isNot: null } },
    },
    select: { id: true },
  });

  return { admin, seller: membership !== null };
}
