/** Convite para a equipe da loja (M-04): vale 7 dias e só pode ser usado uma vez. */
export const SELLER_INVITE_TTL_DAYS = 7;

/**
 * Resposta única para link vencido, já usado, cancelado ou de outro e-mail: não revela se o
 * convite existe nem para quem foi enviado.
 */
export const SELLER_INVITE_UNAVAILABLE_MESSAGE = "Este convite não está disponível para a sua conta.";

/** Mesma resposta exista ou não uma conta com o e-mail convidado (sem enumeração). */
export const SELLER_INVITE_SENT_MESSAGE =
  "Convite registrado. Se houver uma conta com esse e-mail, a pessoa verá o convite ao entrar.";

export type SellerInviteSnapshot = Readonly<{
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED";
  expiresAt: Date;
  email: string;
}>;

export type SellerInviteAccount = Readonly<{ email: string; emailVerified: boolean }>;

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getSellerInviteExpiry(now: Date): Date {
  return new Date(now.getTime() + SELLER_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** O convite só serve para a conta do mesmo e-mail, já verificado, enquanto estiver pendente e no prazo. */
export function canUseSellerInvite(invite: SellerInviteSnapshot, account: SellerInviteAccount, now: Date): boolean {
  if (invite.status !== "PENDING") return false;
  if (invite.expiresAt.getTime() <= now.getTime()) return false;
  if (!account.emailVerified) return false;
  return normalizeInviteEmail(account.email) === normalizeInviteEmail(invite.email);
}

export function getSellerInviteDaysLeft(expiresAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}
