import { CircleCheck } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatCount, formatMoneyInCents } from "@/lib/format";
import { formatCep } from "@/modules/customers/domain/brazilian-address";
import { formatPhone } from "@/modules/customers/domain/tax-id";

import type { SimulatedPurchase } from "../domain/simulated-purchase";

/**
 * "Compra concluída" after the simulated purchase of test products. Everything comes
 * from the server summary; there is no order number because no order exists.
 */
export function SimulatedPurchaseConfirmation({ purchase }: { purchase: SimulatedPurchase }) {
  const firstName = purchase.customer.name.split(" ")[0] ?? purchase.customer.name;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <span className="bg-success-surface text-success border-success/30 mt-8 flex size-11 shrink-0 items-center justify-center rounded-full border">
          <CircleCheck aria-hidden="true" className="size-6" />
        </span>
        <PageHeader
          eyebrow="Compra segura"
          title="Compra concluída"
          description={`Obrigado, ${firstName}. Confira abaixo o resumo da sua compra.`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <Card size="section" render={<section aria-labelledby="purchase-items-title" />}>
            <h2 id="purchase-items-title" className="section-title">
              Itens e frete
            </h2>
            {purchase.stores.map((store) => (
              <PurchaseStore key={store.storeName} store={store} />
            ))}
          </Card>

          <Card size="section" render={<section aria-labelledby="purchase-delivery-title" />}>
            <h2 id="purchase-delivery-title" className="section-title">
              Entrega
            </h2>
            <address className="mt-3 text-sm leading-6 not-italic">
              {purchase.customer.name}
              <br />
              {purchase.address.street}, {purchase.address.number}
              {purchase.address.complement ? ` · ${purchase.address.complement}` : ""}
              <br />
              {purchase.address.neighborhood} · {purchase.address.city}/{purchase.address.state} ·{" "}
              {formatCep(purchase.address.postalCode)}
            </address>
            <p className="text-muted-foreground mt-3 text-xs">Contato</p>
            <p className="text-sm">
              {purchase.customer.email} · {formatPhone(purchase.customer.phone)}
            </p>
          </Card>
        </div>

        <Card size="section" render={<aside aria-labelledby="purchase-summary-title" />} className="h-fit">
          <h2 id="purchase-summary-title" className="section-title">
            Resumo
          </h2>
          <p className="text-muted-foreground mt-3 text-xs">Forma de pagamento</p>
          <p className="mt-1 inline-flex rounded-full border px-3 py-1 text-sm font-medium">Pix</p>
          <PurchaseTotals totals={purchase.totals} />
          <Link href="/products" className={buttonVariants({ size: "lg", className: "mt-5 w-full" })}>
            Continuar comprando
          </Link>
          <Link href="/" className={buttonVariants({ variant: "outline", size: "lg", className: "mt-3 w-full" })}>
            Voltar para a página inicial
          </Link>
        </Card>
      </div>
    </div>
  );
}

function PurchaseStore({ store }: { store: SimulatedPurchase["stores"][number] }) {
  return (
    <div className="mt-4">
      <h3 className="text-foreground font-sans text-sm font-semibold tracking-normal">{store.storeName}</h3>
      <ul className="mt-2 space-y-2 text-sm">
        {store.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-3">
            <span className="min-w-0">
              {item.quantity}× {item.name}
              <span className="text-muted-foreground block text-xs">{item.variant}</span>
            </span>
            <span className="shrink-0 tabular-nums">{formatMoneyInCents(item.lineTotalInCents)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex justify-between gap-3 rounded-lg border p-3 text-sm">
        <span className="min-w-0">
          {store.shipping.label}
          {store.shipping.estimatedDeliveryDays !== undefined ? (
            <span className="text-muted-foreground block text-xs">
              {formatCount(store.shipping.estimatedDeliveryDays, "dia útil", "dias úteis")}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 tabular-nums">{formatMoneyInCents(store.shipping.priceInCents)}</span>
      </p>
    </div>
  );
}

function PurchaseTotals({ totals }: { totals: SimulatedPurchase["totals"] }) {
  return (
    <dl className="bg-surface-sunken mt-4 space-y-2 rounded-lg p-3 text-sm">
      <div className="flex justify-between gap-3">
        <dt>Subtotal ({formatCount(totals.itemCount, "item", "itens")})</dt>
        <dd className="tabular-nums">{formatMoneyInCents(totals.itemsSubtotalInCents)}</dd>
      </div>
      {totals.discountInCents > 0 ? (
        <div className="flex justify-between gap-3">
          <dt>Desconto</dt>
          <dd className="tabular-nums">-{formatMoneyInCents(totals.discountInCents)}</dd>
        </div>
      ) : null}
      <div className="flex justify-between gap-3">
        <dt>Frete</dt>
        <dd className="tabular-nums">{formatMoneyInCents(totals.shippingInCents)}</dd>
      </div>
      <div className="flex justify-between gap-3 border-t pt-2 text-base font-bold">
        <dt>Total</dt>
        <dd className="tabular-nums">{formatMoneyInCents(totals.totalInCents)}</dd>
      </div>
    </dl>
  );
}
