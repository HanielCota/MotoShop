import type { Metadata, Route } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { optionalTextSearchParam, parseSearchParams, type RawSearchParams } from "@/shared/validation/search-params";

export const metadata: Metadata = {
  title: "Pedido recebido",
  robots: { index: false, follow: false },
};

const checkoutSuccessSearchParams = {
  orderNumber: optionalTextSearchParam(64),
  accessToken: optionalTextSearchParam(200),
};

/** Older success links may still carry the guest token: send it through the cookie swap, never to the page URL. */
function orderHref(orderNumber: string, accessToken: string | undefined): Route {
  const orderPath = `/orders/${encodeURIComponent(orderNumber)}`;
  return (accessToken ? `${orderPath}/access?token=${encodeURIComponent(accessToken)}` : orderPath) as Route;
}

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = parseSearchParams(checkoutSuccessSearchParams, await searchParams);
  const { orderNumber } = params;
  return (
    <main className="mx-auto flex w-full max-w-2xl px-4 py-16 sm:px-6">
      <Card className="w-full">
        <CardHeader>
          <h1 className="text-xl leading-snug font-medium">
            {orderNumber ? "Acompanhe seu pedido" : "Não foi possível identificar o pedido"}
          </h1>
          <CardDescription>
            {orderNumber
              ? "Consulte o status atualizado na página do pedido. A confirmação do pagamento é feita pelo servidor."
              : "Não encontramos o número do pedido nesta página. Se você concluiu o checkout, confira seus pedidos ou entre em contato com o Moto Shop."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {orderNumber ? (
            <p>
              Pedido: <strong>{orderNumber}</strong>
            </p>
          ) : null}
          {orderNumber ? (
            <Link className={buttonVariants({ variant: "outline" })} href={orderHref(orderNumber, params.accessToken)}>
              Ver pagamento e acompanhar pedido
            </Link>
          ) : null}
          <Link className={buttonVariants()} href="/products">
            Continuar comprando
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
