import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/database";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { hasSellerPermission } from "@/modules/auth/domain/seller-permissions";
import { MelhorEnvioConnectionCard } from "@/modules/shipping/components/melhor-envio-connection-card";

export default async function SellerShippingIntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ shipping?: string }>;
}) {
  const session = await requireAuthenticatedUser("/seller/shipping/integrations");
  const membership = await db.sellerMember.findFirst({
    where: { userId: session.user.id, seller: { status: { in: ["APPROVED", "ACTIVE"] } } },
    include: { seller: { include: { store: true, shippingIntegration: { select: { id: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  if (!membership?.seller.store || !hasSellerPermission(membership.role, "SELLER_MANAGE"))
    redirect("/seller?error=permission");
  const { shipping } = await searchParams;

  return (
    <section className="space-y-5" aria-labelledby="shipping-integrations-title">
      <div>
        <p className="text-moto-brand text-xs font-bold tracking-[0.18em] uppercase">Sua operação</p>
        <h2 id="shipping-integrations-title" className="mt-2 text-2xl font-bold tracking-tight">
          Integrações de frete
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">Gerencie as contas de frete autorizadas para sua loja.</p>
      </div>
      <MelhorEnvioConnectionCard connected={Boolean(membership.seller.shippingIntegration)} shippingStatus={shipping} />
      <Card>
        <CardHeader>
          <CardTitle>Frete próprio</CardTitle>
          <CardDescription>Continue gerenciando suas opções manuais na tela atual.</CardDescription>
        </CardHeader>
        <CardContent>
          <a
            className="text-moto-brand-strong text-sm font-semibold underline-offset-4 hover:underline"
            href="/seller/shipping"
          >
            Abrir configuração de frete próprio
          </a>
        </CardContent>
      </Card>
    </section>
  );
}
