import Link from "next/link";
import type { Metadata, Route } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireSellerPageContext } from "@/modules/sellers/application/get-seller-dashboard-context";
import { hasSellerShippingIntegration } from "@/modules/sellers/queries/seller-shipping-methods";
import { MelhorEnvioConnectionCard } from "@/modules/shipping/components/melhor-envio-connection-card";

export const metadata: Metadata = {
  title: "Integrações de frete · Central do Lojista",
  robots: { index: false, follow: false },
};

export default async function SellerShippingIntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ shipping?: string }>;
}) {
  const { seller } = await requireSellerPageContext("SELLER_MANAGE");
  const [connected, { shipping }] = await Promise.all([hasSellerShippingIntegration(seller.id), searchParams]);

  return (
    <>
      <PageHeader
        back={{ href: "/seller/shipping", label: "Voltar para frete próprio" }}
        eyebrow="Sua operação"
        title="Integrações de frete"
        description="Gerencie as contas de frete autorizadas para sua loja."
      />
      <MelhorEnvioConnectionCard connected={connected} shippingStatus={shipping} />
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg">Frete próprio</h2>
          </CardTitle>
          <CardDescription>Continue gerenciando suas opções manuais na tela de frete próprio.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            className="text-brand-strong inline-flex min-h-11 items-center text-sm font-semibold underline-offset-4 hover:underline"
            href={"/seller/shipping" as Route}
          >
            Abrir configuração de frete próprio
          </Link>
        </CardContent>
      </Card>
    </>
  );
}
