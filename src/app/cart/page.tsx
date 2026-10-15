import type { Metadata, Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { ImageOff, ShieldCheck, ShoppingBag, Store } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineNotice } from "@/components/ui/inline-notice";
import { pageContainerClassName } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { formatMoneyInCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CartItemControls } from "@/modules/cart/components/cart-item-controls";
import { VisualCartPreview } from "@/modules/cart/components/visual-preview";
import { getActiveCart } from "@/modules/cart/queries/cart";
import { getCheckoutPaymentAvailability } from "@/modules/payments/application/assert-payment-ready";
import { getCurrentPriceInCents } from "@/modules/products/domain/pricing";

import { getCartThumbnails } from "./cart-thumbnails";

export const metadata: Metadata = {
  title: "Carrinho",
  robots: { index: false, follow: false },
};

export default async function CartPage({ searchParams }: { searchParams: Promise<{ preview?: string | string[] }> }) {
  const { preview } = await searchParams;
  if (process.env.NODE_ENV !== "production" && preview === "1") return <VisualCartPreview />;

  const cart = await getActiveCart();
  const items = cart?.items ?? [];
  const thumbnails = await getCartThumbnails(items);
  const groups = Map.groupBy(items, (item) => item.variant.product.sellerId);
  const payment = getCheckoutPaymentAvailability(groups.size);
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const subtotalInCents = items.reduce(
    (total, item) => total + getCurrentPriceInCents(item.variant) * item.quantity,
    0,
  );

  return (
    <main
      className={pageContainerClassName(
        "default",
        cn("flex flex-col gap-6 pt-10", items.length > 0 ? "pb-32 lg:pb-10" : "pb-10"),
      )}
    >
      <PageHeader
        eyebrow="Sua compra"
        title="Carrinho"
        description={
          items.length > 0
            ? `${itemCount} ${itemCount === 1 ? "item" : "itens"} de ${groups.size} ${groups.size === 1 ? "loja" : "lojas"}`
            : undefined
        }
      />

      {items.length === 0 ? (
        <div className="space-y-3">
          <EmptyState
            icon={ShoppingBag}
            title="Seu carrinho está vazio"
            description="Encontre peças, equipamentos e acessórios para sua próxima sessão."
            action={{ label: "Ver produtos", href: "/products" }}
          />
          {process.env.NODE_ENV !== "production" ? (
            <p className="text-center">
              <Link href="/cart?preview=1" className="text-sm underline underline-offset-4">
                Ver prévia com produtos de exemplo
              </Link>
            </p>
          ) : null}
        </div>
      ) : (
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="min-w-0 space-y-4">
            {Array.from(groups.entries()).map(([sellerId, sellerItems]) => {
              const storeName = sellerItems[0]?.variant.product.store.name ?? "Loja";
              const storeSubtotalInCents = sellerItems.reduce(
                (total, item) => total + getCurrentPriceInCents(item.variant) * item.quantity,
                0,
              );
              const storeItemCount = sellerItems.reduce((total, item) => total + item.quantity, 0);
              return (
                <section
                  key={sellerId}
                  aria-labelledby={`cart-store-${sellerId}`}
                  className="bg-card rounded-xl border p-4 sm:p-6"
                >
                  <div className="flex items-start gap-3">
                    <Store aria-hidden="true" className="text-brand-strong mt-1 size-5 shrink-0" />
                    <div>
                      <h2 id={`cart-store-${sellerId}`} className="text-lg font-semibold">
                        {storeName}
                      </h2>
                      <p className="text-muted-foreground text-sm">
                        Itens desta loja são enviados juntos quando possível.
                      </p>
                    </div>
                  </div>
                  <ul className="mt-4 divide-y">
                    {sellerItems.map((item) => {
                      const unitPriceInCents = getCurrentPriceInCents(item.variant);
                      const thumbnail = thumbnails.get(item.variantId);
                      const productHref = `/products/${item.variant.product.slug}` as Route;
                      return (
                        <li key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                          <Link
                            href={productHref}
                            tabIndex={-1}
                            aria-hidden="true"
                            className="bg-surface-sunken relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg sm:size-24"
                          >
                            {thumbnail ? (
                              <Image
                                src={thumbnail.url}
                                alt=""
                                fill
                                sizes="(max-width: 640px) 80px, 96px"
                                className="object-cover"
                              />
                            ) : (
                              <ImageOff className="text-muted-foreground size-6" />
                            )}
                          </Link>
                          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:justify-between">
                            <div className="min-w-0">
                              <Link
                                href={productHref}
                                className="hover:text-brand-strong line-clamp-2 leading-snug font-semibold underline-offset-4 hover:underline"
                              >
                                {item.variant.product.name}
                              </Link>
                              <p className="text-muted-foreground mt-1 text-xs">
                                {item.variant.title} · SKU {item.variant.sku}
                              </p>
                              <p className="text-muted-foreground mt-2 text-sm">
                                {formatMoneyInCents(unitPriceInCents)} por unidade
                              </p>
                            </div>
                            <CartItemControls
                              cartItemId={item.id}
                              quantity={item.quantity}
                              productName={item.variant.product.name}
                              maxQuantity={item.variant.inventory?.availableQuantity ?? 0}
                              unitPriceInCents={unitPriceInCents}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4 text-sm">
                    <span className="text-muted-foreground">
                      Subtotal desta loja ({storeItemCount} {storeItemCount === 1 ? "item" : "itens"})
                    </span>
                    <span className="font-semibold tabular-nums">{formatMoneyInCents(storeSubtotalInCents)}</span>
                  </div>
                </section>
              );
            })}
          </div>

          <aside
            aria-labelledby="cart-summary-title"
            className="bg-card h-fit rounded-xl border p-4 sm:p-6 lg:sticky lg:top-24"
          >
            <h2 id="cart-summary-title" className="text-lg font-semibold">
              Resumo
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt>
                  Subtotal ({itemCount} {itemCount === 1 ? "item" : "itens"})
                </dt>
                <dd className="font-semibold tabular-nums">{formatMoneyInCents(subtotalInCents)}</dd>
              </div>
              <div className="text-muted-foreground flex items-center justify-between gap-3">
                <dt>Frete</dt>
                <dd>{payment.available ? "Calculado na finalização" : "Calculado por loja"}</dd>
              </div>
            </dl>
            {payment.available ? null : (
              <InlineNotice tone="warning" className="mt-4">
                As compras ainda não estão liberadas. Você pode conferir frete e entrega, mas o pagamento ainda não abre
                e nenhum pedido é criado.
              </InlineNotice>
            )}
            <Link className={buttonVariants({ size: "lg", className: "mt-5 w-full" })} href={"/checkout" as Route}>
              {payment.available ? "Finalizar compra" : "Conferir frete e entrega"}
            </Link>
            <Link
              href="/products"
              className={cn(buttonVariants({ variant: "link-muted", size: "link" }), "mt-3 flex w-full")}
            >
              Continuar comprando
            </Link>
            <p className="text-muted-foreground mt-3 flex items-start gap-2 text-xs">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              Preços e estoque são confirmados novamente ao finalizar a compra.
            </p>
          </aside>

          {/* Mobile/tablet: CTA sempre ao alcance do polegar; o resumo completo segue acima. */}
          <div
            data-slot="cart-sticky-checkout"
            className="bg-background/95 z-sticky-bar fixed inset-x-0 bottom-0 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgb(0_0_0/0.08)] backdrop-blur lg:hidden"
          >
            <div className="mx-auto flex max-w-6xl items-center gap-3">
              <div className="min-w-0 flex-1">
                {payment.available ? (
                  <p className="text-muted-foreground text-xs">Subtotal · frete na finalização</p>
                ) : (
                  <p className="text-warning-foreground text-xs font-semibold">Pagamento ainda não liberado</p>
                )}
                <p className="text-base font-bold tabular-nums">{formatMoneyInCents(subtotalInCents)}</p>
              </div>
              <Link className={buttonVariants({ className: "shrink-0" })} href={"/checkout" as Route}>
                {payment.available ? "Finalizar compra" : "Conferir frete"}
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
