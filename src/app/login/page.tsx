import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/modules/auth/components/auth-form";
import { AuthPageShell } from "@/modules/auth/components/auth-page-shell";
import { authEmailConfigured, authEmailVerificationRequired } from "@/modules/auth/infrastructure/auth";

export const metadata: Metadata = {
  title: "Entrar",
};

export default function LoginPage() {
  return (
    <AuthPageShell>
      <Suspense fallback={<p className="text-muted-foreground text-sm">Carregando...</p>}>
        <AuthForm emailEnabled={authEmailConfigured} verificationRequired={authEmailVerificationRequired} />
      </Suspense>
    </AuthPageShell>
  );
}
