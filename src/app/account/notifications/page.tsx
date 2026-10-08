import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/database";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { NotificationPreferencesForm } from "@/modules/notifications/components/notification-preferences-form";
import { CustomerAccountShell } from "@/modules/customers/components/customer-account-shell";

export default async function NotificationPreferencesPage() {
  const session = await requireAuthenticatedUser("/account/notifications");
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { emailOrderUpdatesEnabled: true } });

  return (
    <CustomerAccountShell pathname="/account/notifications">
      <PageHeader
        eyebrow="Minha conta"
        title="Notificações"
        description="Escolha como acompanhar as atualizações dos seus pedidos."
      />
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-xl">Preferências de e-mail</h2>
          </CardTitle>
          <CardDescription>As alterações valem para os próximos eventos do pedido.</CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationPreferencesForm emailOrderUpdatesEnabled={user?.emailOrderUpdatesEnabled ?? true} />
        </CardContent>
      </Card>
    </CustomerAccountShell>
  );
}
