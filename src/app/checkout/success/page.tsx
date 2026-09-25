import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ orderNumber?: string; accessToken?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-2xl px-4 py-16 sm:px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Pedido criado</CardTitle>
          <CardDescription>
            O pagamento será confirmado pelo servidor e o pedido seguirá para processamento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Pedido: <strong>{params.orderNumber ?? "não informado"}</strong>
          </p>
          {params.orderNumber ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`/orders/${encodeURIComponent(params.orderNumber)}${params.accessToken ? `?accessToken=${encodeURIComponent(params.accessToken)}` : ""}`}
            >
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
