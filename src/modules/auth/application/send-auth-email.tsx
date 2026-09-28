import "server-only";

import { createHash } from "node:crypto";

import { env } from "@/config/env";
import { sendNotificationEmail } from "@/modules/notifications/application/send-notification-email";

type AuthEmailKind = "verify" | "reset";

export async function sendAuthEmail(input: { kind: AuthEmailKind; to: string; url: string; token: string }) {
  const target = new URL(input.url);
  if (target.origin !== new URL(env.BETTER_AUTH_URL).origin) {
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
    subject: isVerification ? "Confirme seu e-mail na Moto Shop" : "Redefina sua senha na Moto Shop",
    react: (
      <div style={{ color: "#172033", fontFamily: "Arial, sans-serif", lineHeight: 1.5 }}>
        <h1>{isVerification ? "Confirme seu e-mail" : "Redefina sua senha"}</h1>
        <p>
          {isVerification
            ? "Use o link abaixo para confirmar seu endereço de e-mail na Moto Shop."
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
