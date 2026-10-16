import Link from "next/link";
import type { Metadata, Route } from "next";
import { Plug, Truck } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatMoneyInCents } from "@/lib/format";
import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { listSellerShippingMethods } from "@/modules/sellers/queries/seller-shipping-methods";
import { OwnShippingMethodForm, OwnShippingToggle } from "@/modules/shipping/components/own-shipping-forms";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Frete · Central do Lojista",
  robots: { index: false, follow: false },
};

export default async function SellerShippingPage() {
  const context = await requireSellerAccess("SELLER_MANAGE");
  const methods = await listSellerShippingMethods(context.seller.id);

  return (
    <>
      <PageHeader
        eyebrow="Sua operação"
        title="Frete próprio"
        description="Defina onde sua loja entrega, o valor e o prazo. Não depende do Melhor Envio e não compra etiquetas."
        actions={
          <Link
            href={"/seller/shipping/integrations" as Route}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            <Plug aria-hidden="true" />
            Integrações de frete
          </Link>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Nova modalidade</CardTitle>
          <CardDescription>
            O preço é fixo para todos os itens da sua loja no pedido, não por produto. O prazo é contado em dias úteis
            após a confirmação do pagamento. Novas modalidades começam desativadas. Para substituir uma regra, crie
            outra e desative a anterior; pedidos existentes mantêm as condições contratadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OwnShippingMethodForm />
        </CardContent>
      </Card>
      <section className="grid gap-4" aria-labelledby="shipping-methods-title">
        <h2 id="shipping-methods-title" className="text-xl">
          Modalidades cadastradas
        </h2>
        {methods.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="Nenhuma modalidade cadastrada"
            description="Crie a primeira modalidade acima para oferecer entrega própria."
          />
        ) : (
          methods.map((method) => (
            <Card key={method.id}>
              <CardContent className="grid gap-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base">{method.name}</h3>
                  <Badge variant={method.active ? "success" : "neutral"}>
                    {method.active ? "Ativa" : "Desativada"}
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  CEPs {method.postalCodeStart} a {method.postalCodeEnd}
                </p>
                <p className="tabular-nums">
                  {formatMoneyInCents(method.priceInCents)} · até {method.estimatedDeliveryDays}{" "}
                  {method.estimatedDeliveryDays === 1 ? "dia útil" : "dias úteis"}
                </p>
                <OwnShippingToggle id={method.id} active={method.active} />
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </>
  );
}
