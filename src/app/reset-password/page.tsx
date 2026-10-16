import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { AuthPageShell } from "@/modules/auth/components/auth-page-shell";
import { ResetPasswordForm } from "@/modules/auth/components/reset-password-form";
import { parseSearchParams, searchParam, type RawSearchParams } from "@/shared/validation/search-params";

export const metadata: Metadata = {
  title: "Nova senha",
  robots: { index: false, follow: false },
};

const resetPasswordSearchParams = {
  token: searchParam(
    z
      .string()
      .regex(/^[A-Za-z0-9_-]{12,128}$/)
      .optional(),
    undefined,
  ),
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { token } = parseSearchParams(resetPasswordSearchParams, await searchParams);
  return (
    <AuthPageShell title="Nova senha" description="Escolha uma senha com pelo menos oito caracteres.">
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="text-sm">
          Este link é inválido ou expirou.{" "}
          <Link className="text-brand-strong underline" href="/forgot-password">
            Solicitar novo link
          </Link>
        </p>
      )}
    </AuthPageShell>
  );
}
