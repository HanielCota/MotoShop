import Image from "next/image";
import Link from "next/link";

import { pageContainerClassName } from "@/components/ui/page-container";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { formatMoneyInCents } from "@/lib/format";

type PreviewItemData = {
  name: string;
  variant: string;
  image: string;
  quantity: number;
  priceInCents: number;
};

type PreviewGroup = {
  store: string;
  shippingInCents: number;
  items: PreviewItemData[];
};

const previewGroups: PreviewGroup[] = [
  {
    store: "Pista Norte (demonstração)",
    shippingInCents: 2490,
    items: [
      {
        name: "Capacete off-road Apex preto e laranja",
        variant: "Preto/laranja, tamanho M",
        image: "/images/demo/capacete-apex.webp",
        quantity: 1,
        priceInCents: 62990,
      },
      {
        name: "Botas off-road Terra pretas e laranja",
        variant: "Preto/laranja, tamanho 41",
        image: "/images/demo/botas-terra.webp",
        quantity: 1,
        priceInCents: 87990,
      },
    ],
  },
  {
    store: "Trilha Sul (demonstração)",
    shippingInCents: 1890,
    items: [
      {
        name: "Óculos off-road Vista com lente transparente",
        variant: "Preto/laranja, tamanho único",
        image: "/images/demo/oculos-vista.webp",
        quantity: 2,
        priceInCents: 21990,
      },
      {
        name: "Disco de freio dianteiro Onda",
        variant: "Aço, aplicação a confirmar",
        image: "/images/demo/disco-onda.webp",
        quantity: 1,
        priceInCents: 28990,
      },
    ],
  },
];

const itemCount = previewGroups.reduce(
  (total, group) => total + group.items.reduce((count, item) => count + item.quantity, 0),
  0,
);
const subtotalInCents = previewGroups.reduce(
  (total, group) => total + group.items.reduce((sum, item) => sum + item.priceInCents * item.quantity, 0),
  0,
);
const shippingInCents = previewGroups.reduce((total, group) => total + group.shippingInCents, 0);

function PreviewNotice() {
  return (
    <div
      role="note"
      className="border-moto-brand/40 bg-moto-brand-surface rounded-lg border px-4 py-3 text-sm leading-6"
    >
      <strong>Prévia visual.</strong> Produtos, quantidades e valores são exemplos. Nada é salvo no carrinho e não é
      possível criar pedidos ou pagamentos nesta tela.
    </div>
  );
}

function PreviewItem({ item }: { item: PreviewItemData }) {
  return (
    <div className="border-border flex gap-4 border-t py-4 first:border-t-0 first:pt-0 last:pb-0">
      <div className="bg-surface-sunken relative size-20 shrink-0 overflow-hidden rounded-lg sm:size-24">
        <Image src={item.image} alt="" fill sizes="(max-width: 640px) 80px, 96px" className="object-cover" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 sm:flex-row">
        <div>
          <p className="leading-snug font-semibold">{item.name}</p>
          <p className="text-muted-foreground mt-1 text-xs">{item.variant}</p>
          <p className="text-muted-foreground mt-2 text-sm">
            {item.quantity} × {formatMoneyInCents(item.priceInCents)} ={" "}
            {formatMoneyInCents(item.priceInCents * item.quantity)}
          </p>
        </div>
        <strong className="shrink-0 tabular-nums">{formatMoneyInCents(item.priceInCents * item.quantity)}</strong>
      </div>
    </div>
  );
}

export function VisualCartPreview() {
  return (
    <main className={pageContainerClassName("default", "flex flex-col gap-6 py-10")}>
      <PageHeader eyebrow="Sua compra" title="Carrinho" />
      <PreviewNotice />
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-4">
          {previewGroups.map((group) => (
            <section key={group.store} className="bg-card rounded-xl border p-4 sm:p-6">
              <h2 className="section-title">{group.store}</h2>
              <p className="text-muted-foreground mb-5 text-sm">Envio calculado separadamente para esta loja.</p>
              {group.items.map((item) => (
                <PreviewItem key={item.name} item={item} />
              ))}
            </section>
          ))}
        </div>
        <aside className="bg-card rounded-xl border p-4 sm:p-6">
          <h2 className="section-title">Resumo</h2>
          <div className="mt-5 flex justify-between gap-3 text-sm">
            <span>Itens ({itemCount})</span>
            <span>{formatMoneyInCents(subtotalInCents)}</span>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">O frete é exibido na prévia do checkout.</p>
          <Link href="/checkout?preview=1" className={buttonVariants({ className: "mt-6 w-full" })}>
            Ver prévia do checkout
          </Link>
          <Link href="/cart" className="mt-4 block text-center text-sm underline underline-offset-4">
            Ver meu carrinho real
          </Link>
        </aside>
      </div>
    </main>
  );
}

export function VisualCheckoutPreview() {
  return (
    <main className={pageContainerClassName("default", "flex flex-col gap-6 py-10")}>
      <PageHeader eyebrow="Compra segura" title="Finalizar compra" />
      <PreviewNotice />
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          <section className="bg-card rounded-xl border p-4 sm:p-6">
            <h2 className="section-title">Seus dados</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <PreviewField label="Nome completo" value="Comprador de demonstração" />
              <PreviewField label="E-mail" value="cliente@exemplo.com" />
              <PreviewField label="Telefone" value="(11) 90000-0000" />
              <PreviewField label="Seu CPF" value="Somente no pedido real" />
            </div>
          </section>
          <section className="bg-card rounded-xl border p-4 sm:p-6">
            <h2 className="section-title">Endereço de entrega</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <PreviewField label="CEP" value="00000-000" />
              <PreviewField label="Rua" value="Endereço ilustrativo" />
              <PreviewField label="Número" value="123" />
              <PreviewField label="Bairro" value="Bairro de exemplo" />
              <PreviewField label="Cidade" value="Cidade de exemplo" />
              <PreviewField label="UF" value="SP" />
            </div>
          </section>
          <section className="bg-card rounded-xl border p-4 sm:p-6">
            <h2 className="section-title">Frete por loja</h2>
            <p className="text-muted-foreground mt-1 text-sm">Opções e preços ilustrativos.</p>
            <div className="mt-4 space-y-3">
              {previewGroups.map((group) => (
                <div key={group.store} className="flex flex-wrap justify-between gap-2 rounded-lg border p-3 text-sm">
                  <span>
                    {group.store}
                    <span className="text-muted-foreground block text-xs">
                      Entrega padrão · estimativa ilustrativa: 3 a 6 dias úteis
                    </span>
                  </span>
                  <strong>{formatMoneyInCents(group.shippingInCents)}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="bg-card min-w-0 rounded-xl border p-4 sm:p-6">
          <h2 className="section-title">Resumo do pedido</h2>
          <p className="text-muted-foreground mt-1 text-xs">{itemCount} itens de 2 lojas</p>
          <div className="mt-5 space-y-3 border-b pb-5">
            {previewGroups
              .flatMap((group) => group.items)
              .map((item) => (
                <div key={item.name} className="flex justify-between gap-3 text-sm">
                  <span>
                    {item.quantity}× {item.name}
                  </span>
                  <span className="shrink-0 tabular-nums">{formatMoneyInCents(item.priceInCents * item.quantity)}</span>
                </div>
              ))}
          </div>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Itens</span>
              <span>{formatMoneyInCents(subtotalInCents)}</span>
            </div>
            <div className="flex justify-between">
              <span>Frete</span>
              <span>{formatMoneyInCents(shippingInCents)}</span>
            </div>
            <div className="flex justify-between border-t pt-3 font-semibold">
              <span>Total ilustrativo</span>
              <span>{formatMoneyInCents(subtotalInCents + shippingInCents)}</span>
            </div>
          </div>
          <p className="text-muted-foreground bg-surface-sunken mt-5 rounded-lg p-3 text-sm">
            Pagamento desativado nesta prévia. Nenhum pedido será criado.
          </p>
          <Link href="/cart?preview=1" className="mt-5 block text-center text-sm underline underline-offset-4">
            Voltar ao carrinho de demonstração
          </Link>
        </aside>
      </div>
    </main>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
      {label}
      <Input value={value} readOnly aria-readonly="true" className="text-muted-foreground" />
    </label>
  );
}
