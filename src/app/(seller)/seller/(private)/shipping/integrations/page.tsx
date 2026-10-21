import Link from "next/link";
import type { Metadata, Route } from "next";
import { z } from "zod";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireSellerPageContext } from "@/modules/sellers/application/get-seller-dashboard-context";
import { hasSellerShippingIntegration } from "@/modules/sellers/queries/seller-shipping-methods";
import { MelhorEnvioConnectionCard } from "@/modules/shipping/components/melhor-envio-connection-card";
import { parseSearchParams, searchParam, type RawSearchParams } from "@/shared/validation/search-params";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Integrações de frete · Central do Lojista",
  robots: { index: false, follow: false },
};

// Statuses set by the Melhor Envio OAuth callback redirect.
const shippingIntegrationSearchParams = {
  shipping: searchParam(
    z.enum(["connected", "authorization_failed", "session_expired", "permission_denied"]).optional(),
    undefined,
  ),
};

export default async function SellerShippingIntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { seller } = await requireSellerPageContext("SELLER_MANAGE");
  const [connected, rawSearchParams] = await Promise.all([hasSellerShippingIntegration(seller.id), searchParams]);
  const { shipping } = parseSearchParams(shippingIntegrationSearchParams, rawSearchParams);

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
          <CardTitle>Frete próprio</CardTitle>
          <CardDescription>Continue gerenciando suas opções manuais na tela de frete próprio.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link className={buttonVariants({ variant: "link", size: "link" })} href={"/seller/shipping" as Route}>
            Abrir configuração de frete próprio
          </Link>
        </CardContent>
      </Card>
    </>
  );
}
