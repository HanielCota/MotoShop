import type { Metadata } from "next";
import { connection } from "next/server";
import { AuthForm } from "@/modules/auth/components/auth-form";
import { AuthPageShell } from "@/modules/auth/components/auth-page-shell";
import { authEmailConfigured, authEmailVerificationRequired } from "@/modules/auth/infrastructure/auth";

export const metadata: Metadata = {
  title: "Entrar",
};

export default async function LoginPage() {
  // Rendered per request, so the form reads ?modo, ?next and ?verified on the server and arrives
  // ready: a prerendered page showed a "Carregando..." placeholder until the browser took over,
  // and the card grew when the form replaced it.
  await connection();
  return (
    <AuthPageShell>
      <AuthForm emailEnabled={authEmailConfigured} verificationRequired={authEmailVerificationRequired} />
    </AuthPageShell>
  );
}
