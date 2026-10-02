import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/database";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { NotificationPreferencesForm } from "@/modules/notifications/components/notification-preferences-form";
import { CustomerAccountNavigation } from "@/modules/customers/components/customer-account-navigation";

export default async function NotificationPreferencesPage() {
  const session = await requireAuthenticatedUser("/account/notifications");
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { emailOrderUpdatesEnabled: true } });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <CustomerAccountNavigation pathname="/account/notifications" />
        <div className="flex min-w-0 flex-col gap-8">
          <div>
            <Badge variant="secondary">Minha conta</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Notificações</h1>
            <p className="text-muted-foreground mt-3">Escolha como acompanhar as atualizações dos seus pedidos.</p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Preferências de e-mail</CardTitle>
              <CardDescription>As alterações valem para os próximos eventos do pedido.</CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationPreferencesForm emailOrderUpdatesEnabled={user?.emailOrderUpdatesEnabled ?? true} />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
