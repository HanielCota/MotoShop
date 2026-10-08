import "server-only";

import { createHash } from "node:crypto";

import { getApplicationBaseUrl } from "@/config/get-application-base-url";
import { sendNotificationEmail } from "@/modules/notifications/application/send-notification-email";

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
      <div style={{ color: "#172033", fontFamily: "Arial, sans-serif", lineHeight: 1.5 }}>
        <h1>{isVerification ? "Confirme seu e-mail" : "Redefina sua senha"}</h1>
        <p>
          {isVerification
            ? "Use o link abaixo para confirmar seu endereço de e-mail no Moto Shop."
            : "Recebemos uma solicitação para redefinir sua senha. Se não foi você, ignore esta mensagem."}
        </p>
        <p>
          <a href={target.toString()}> {isVerification ? "Confirmar e-mail" : "Criar nova senha"} </a>
        </p>
        <p>O link expira em uma hora e não deve ser compartilhado.</p>
      </div>
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
      <div style={{ color: "#172033", fontFamily: "Arial, sans-serif", lineHeight: 1.5 }}>
        <h1>Você já tem uma conta</h1>
        <p>Alguém tentou criar uma conta no Moto Shop com este e-mail, que já está cadastrado.</p>
        <p>
          <a href={`${baseUrl}/login`}>Entrar na minha conta</a> ·{" "}
          <a href={`${baseUrl}/forgot-password`}>Esqueci minha senha</a>
        </p>
        <p>Se não foi você, ignore esta mensagem. Nenhum dado da conta foi alterado.</p>
      </div>
    ),
  });
}
