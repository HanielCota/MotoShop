import "server-only";

import { env } from "@/config/env";
import { db } from "@/lib/database";
import { logger } from "@/lib/logger";

import { isConfiguredAdminEmail } from "../domain/admin-emails";

/**
 * L-19: someone could sign up with an admin e-mail first and set the password; once the real
 * admin clicked the verification link, that account would become a verified admin with the
 * attacker's password. When an ADMIN_EMAILS address is verified, its password is discarded and
 * its sessions end, so the admin sets a password through "Esqueci minha senha", which proves
 * control of the inbox.
 */
export async function secureAdminAccountAfterVerification(user: { id: string; email: string }): Promise<void> {
  if (!isConfiguredAdminEmail(user.email, env.ADMIN_EMAILS)) return;

  await db.$transaction([
    db.account.updateMany({ where: { userId: user.id, providerId: "credential" }, data: { password: null } }),
    db.session.deleteMany({ where: { userId: user.id } }),
  ]);
  logger.info({ event: "auth.admin_password_reset_required", userId: user.id });
}
