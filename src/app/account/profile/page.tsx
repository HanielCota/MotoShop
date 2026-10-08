import type { Metadata } from "next";
import { BadgeCheck, MailWarning } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/database";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { CustomerAccountShell } from "@/modules/customers/components/customer-account-shell";
import { CustomerNameForm } from "@/modules/customers/components/customer-name-form";
import { NotificationPreferencesForm } from "@/modules/notifications/components/notification-preferences-form";

export const metadata: Metadata = { title: "Dados cadastrais", robots: { index: false } };

export default async function CustomerProfilePage() {
  const session = await requireAuthenticatedUser("/account/profile");
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, emailVerified: true, emailOrderUpdatesEnabled: true },
  });
  const name = user?.name ?? session.user.name;
  const email = user?.email ?? session.user.email;
  const emailVerified = user?.emailVerified ?? session.user.emailVerified;

  return (
    <CustomerAccountShell pathname="/account/profile" userName={name}>
      <PageHeader
        eyebrow="Minha conta"
        title="Dados cadastrais"
        description="Confira e atualize as informações da sua conta."
      />

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-xl">Seus dados</h2>
          </CardTitle>
          <CardDescription className="text-base">
            O nome aparece nos seus pedidos e na saudação da conta.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <CustomerNameForm defaultName={name} />
          <dl className="border-border flex flex-col gap-2 border-t pt-5">
            <dt className="text-base font-medium">E-mail</dt>
            <dd className="flex flex-wrap items-center gap-2 text-base break-all">
              {email}
              {emailVerified ? (
                <Badge variant="success">
                  <BadgeCheck aria-hidden="true" />
                  Verificado
                </Badge>
              ) : (
                <Badge variant="warning">
                  <MailWarning aria-hidden="true" />
                  Não verificado
                </Badge>
              )}
            </dd>
            <dd className="text-muted-foreground text-sm">
              O e-mail é usado para entrar e receber avisos dos pedidos e não pode ser alterado por aqui.
            </dd>
          </dl>
        </CardContent>
      </Card>

      <Card id="notificacoes" className="scroll-mt-28">
        <CardHeader>
          <CardTitle>
            <h2 className="text-xl">Notificações por e-mail</h2>
          </CardTitle>
          <CardDescription className="text-base">
            As alterações valem para os próximos eventos do pedido.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationPreferencesForm emailOrderUpdatesEnabled={user?.emailOrderUpdatesEnabled ?? true} />
        </CardContent>
      </Card>
    </CustomerAccountShell>
  );
}
