import "server-only";

import { env } from "@/config/env";
import { db } from "@/lib/database";
import { logger } from "@/lib/logger";

import { isConfiguredAdminEmail } from "../domain/admin-emails";

type VerifiedUser = { id: string; email: string };
/** Better Auth's own reset request, so the token and the e-mail are the ones "Esqueci minha senha" uses. */
type RequestPasswordReset = (email: string) => Promise<unknown>;

/**
 * L-19: someone could sign up with an admin e-mail first and set the password; once the real
 * admin clicked the verification link, that account would become a verified admin with the
 * attacker's password. When an ADMIN_EMAILS address is verified, its password is discarded and
 * its sessions end, so the admin sets a password through a reset link sent to that inbox.
 *
 * The reset e-mail goes out only when a password was actually discarded here: a second verification
 * (a double click on the link, or a later e-mail change) finds no password left and sends nothing.
 */
export async function secureAdminAccountAfterVerification(
  user: VerifiedUser,
  requestPasswordReset: RequestPasswordReset,
): Promise<void> {
  if (isConfiguredAdminEmail(user.email, env.ADMIN_EMAILS) === false) return;

  const [discarded] = await db.$transaction([
    db.account.updateMany({
      where: { userId: user.id, providerId: "credential", password: { not: null } },
      data: { password: null },
    }),
    db.session.deleteMany({ where: { userId: user.id } }),
  ]);
  logger.info({ event: "auth.admin_password_reset_required", userId: user.id });
  if (discarded.count === 0) return;

  await sendAdminPasswordReset(user, requestPasswordReset);
}

/** A failed send must not fail the verification: the admin can still use "Esqueci minha senha". */
async function sendAdminPasswordReset(user: VerifiedUser, requestPasswordReset: RequestPasswordReset): Promise<void> {
  try {
    await requestPasswordReset(user.email);
    logger.info({ event: "auth.admin_password_reset_sent", userId: user.id });
  } catch (error) {
    logger.error({ event: "auth.admin_password_reset_failed", userId: user.id, error });
  }
}
