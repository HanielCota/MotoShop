import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { ChangePasswordForm } from "@/modules/customers/components/change-password-form";
import { CustomerAccountShell } from "@/modules/customers/components/customer-account-shell";

export const metadata: Metadata = { title: "Redefinir senha", robots: { index: false } };

export default async function CustomerPasswordPage() {
  const session = await requireAuthenticatedUser("/account/password");

  return (
    <CustomerAccountShell pathname="/account/password" userName={session.user.name}>
      <PageHeader
        eyebrow="Minha conta"
        title="Redefinir senha"
        description="Troque a senha que você usa para entrar no Moto Shop."
      />
      <Card>
        <CardHeader>
          <CardTitle>Nova senha</CardTitle>
          <CardDescription className="text-base">
            Informe a senha atual e escolha uma nova. Depois da troca, os outros aparelhos conectados à sua conta
            precisarão entrar de novo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </CustomerAccountShell>
  );
}
