import "server-only";

import { createHash } from "node:crypto";

import { getApplicationBaseUrl } from "@/config/get-application-base-url";
import { sendNotificationEmail } from "@/modules/notifications/application/send-notification-email";
import { EmailButton, EmailLink, EmailNote, EmailText, EmailTitle } from "@/modules/notifications/emails/email-layout";

type AuthEmailKind = "verify" | "reset";

export async function sendAuthEmail(input: { kind: AuthEmailKind; to: string; url: string; token: string }) {
  const target = new URL(input.url);
  if (target.origin !== getApplicationBaseUrl()) {
    throw new Error("Invalid authentication email destination.");
  }

  const verificationKey = createHash("sha256").update(input.token).digest("hex");
  const isVerification = input.kind === "verify";
  if (isVerification && (!target.searchParams.has("callbackURL") || target.searchParams.get("callbackURL") === "/")) {
    target.searchParams.set("callbackURL", "/login?verified=1");
  }
  await sendNotificationEmail({
    eventKey: `auth.${input.kind}:${verificationKey}`,
    kind: isVerification ? "AUTH_EMAIL_VERIFICATION" : "AUTH_PASSWORD_RESET",
    to: input.to,
    subject: isVerification ? "Confirme seu e-mail no Moto Shop" : "Redefina sua senha no Moto Shop",
    react: (
      <>
        <EmailTitle>{isVerification ? "Confirme seu e-mail" : "Redefina sua senha"}</EmailTitle>
        <EmailText>
          {isVerification
            ? "Use o link abaixo para confirmar seu endereço de e-mail no Moto Shop."
            : "Recebemos uma solicitação para redefinir sua senha. Se não foi você, ignore esta mensagem."}
        </EmailText>
        <EmailButton href={target.toString()}>{isVerification ? "Confirmar e-mail" : "Criar nova senha"}</EmailButton>
        <EmailNote>O link expira em uma hora e não deve ser compartilhado.</EmailNote>
      </>
    ),
  });
}

/**
 * Sent when someone signs up with an e-mail that already has an account. With e-mail verification
 * required, the sign-up response is the same for new and existing e-mails (no account enumeration),
 * so the owner learns about it here instead. One message per address per day caps abuse.
 */
export async function sendExistingAccountEmail(input: { to: string; now?: Date }) {
  const baseUrl = getApplicationBaseUrl();
  const day = (input.now ?? new Date()).toISOString().slice(0, 10);
  const addressKey = createHash("sha256").update(input.to.toLowerCase()).digest("hex");
  await sendNotificationEmail({
    eventKey: `auth.existing-account:${addressKey}:${day}`,
    kind: "AUTH_EXISTING_ACCOUNT",
    to: input.to,
    subject: "Você já tem uma conta no Moto Shop",
    react: (
      <>
        <EmailTitle>Você já tem uma conta</EmailTitle>
        <EmailText>Alguém tentou criar uma conta no Moto Shop com este e-mail, que já está cadastrado.</EmailText>
        <EmailButton href={`${baseUrl}/login`}>Entrar na minha conta</EmailButton>
        <EmailText>
          <EmailLink href={`${baseUrl}/forgot-password`}>Esqueci minha senha</EmailLink>
        </EmailText>
        <EmailNote>Se não foi você, ignore esta mensagem. Nenhum dado da conta foi alterado.</EmailNote>
      </>
    ),
  });
}
