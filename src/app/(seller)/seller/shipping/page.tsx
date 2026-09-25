import Link from "next/link";
import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { db } from "@/lib/database";
import { formatMoneyInCents } from "@/lib/utils";
import { OwnShippingMethodForm, OwnShippingToggle } from "@/modules/shipping/components/own-shipping-forms";

export default async function SellerShippingPage() {
  const context = await requireSellerAccess("SELLER_MANAGE");
  const methods = await db.sellerShippingMethod.findMany({
    where: { sellerId: context.seller.id },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <Link href="/seller" className="underline">
        Voltar à central
      </Link>
      <header>
        <h2 className="text-2xl font-semibold">Frete próprio</h2>
        <p className="text-muted-foreground mt-2">
          Defina onde sua loja entrega, o valor e o prazo. Não depende do Melhor Envio e não compra etiquetas.
        </p>
      </header>
      <section className="rounded-xl border p-5">
        <h3 className="mb-4 text-lg font-semibold">Nova modalidade</h3>
        <p className="text-muted-foreground mb-4 text-sm">
          O preço é fixo para todos os itens da sua loja no pedido, não por produto. O prazo é contado em dias úteis
          após a confirmação do pagamento. Novas modalidades começam desativadas. Para substituir uma regra, crie outra
          e desative a anterior; pedidos existentes mantêm as condições contratadas.
        </p>
        <OwnShippingMethodForm />
      </section>
      <section className="grid gap-4" aria-label="Modalidades cadastradas">
        {methods.length === 0 && <p>Nenhuma modalidade cadastrada.</p>}
        {methods.map((method) => (
          <article key={method.id} className="grid gap-3 rounded-xl border p-5">
            <h3 className="font-semibold">
              {method.name} · {method.active ? "Ativa" : "Desativada"}
            </h3>
            <p>
              CEPs {method.postalCodeStart} a {method.postalCodeEnd}
            </p>
            <p>
              {formatMoneyInCents(method.priceInCents)} · até {method.estimatedDeliveryDays} dia(s) úteis
            </p>
            <OwnShippingToggle id={method.id} active={method.active} />
          </article>
        ))}
      </section>
    </div>
  );
}
