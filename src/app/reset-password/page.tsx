import Link from "next/link";

import { AuthPageShell } from "@/modules/auth/components/auth-page-shell";
import { ResetPasswordForm } from "@/modules/auth/components/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthPageShell title="Nova senha" description="Escolha uma senha com pelo menos oito caracteres.">
      {token && /^[A-Za-z0-9_-]{12,128}$/.test(token) ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="text-sm">
          Este link é inválido ou expirou.{" "}
          <Link className="text-brand-text underline" href="/forgot-password">
            Solicitar novo link
          </Link>
        </p>
      )}
    </AuthPageShell>
  );
}
