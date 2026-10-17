import { Card } from "@/components/ui/card";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { ShoppingBag, Store } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { pageContainerClassName } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { formatMoneyInCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CartItemControls } from "@/modules/cart/components/cart-item-controls";
import { CartItemThumbnail } from "@/modules/cart/components/cart-item-thumbnail";
import { getActiveCart } from "@/modules/cart/queries/cart";
import { getCartThumbnails } from "@/modules/cart/queries/cart-thumbnails";
import { getCurrentPriceInCents } from "@/modules/products/domain/pricing";

export const metadata: Metadata = {
  title: "Carrinho",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const cart = await getActiveCart();
  const items = cart?.items ?? [];
  const thumbnails = await getCartThumbnails(items);
  const groups = Map.groupBy(items, (item) => item.variant.product.sellerId);
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
        <EmptyState
          icon={ShoppingBag}
          title="Seu carrinho está vazio"
          description="Encontre peças, equipamentos e acessórios para sua próxima sessão."
          action={{ label: "Ver produtos", href: "/products" }}
        />
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
                <Card key={sellerId} size="section" render={<section aria-labelledby={`cart-store-${sellerId}`} />}>
                  <div className="flex items-start gap-3">
                    <Store aria-hidden="true" className="text-brand-strong mt-1 size-5 shrink-0" />
                    <div>
                      <h2 id={`cart-store-${sellerId}`} className="section-title">
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
                          <Link href={productHref} tabIndex={-1} aria-hidden="true" className="shrink-0">
                            <CartItemThumbnail
                              url={thumbnail?.url}
                              sizes="(max-width: 640px) 80px, 96px"
                              className="size-20 sm:size-24"
                            />
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
                </Card>
              );
            })}
          </div>

          <Card
            size="section"
            render={<aside aria-labelledby="cart-summary-title" />}
            className="h-fit lg:sticky lg:top-24"
          >
            <h2 id="cart-summary-title" className="section-title">
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
                <dd>Calculado na finalização</dd>
              </div>
            </dl>
            <Link className={buttonVariants({ size: "lg", className: "mt-5 w-full" })} href={"/checkout" as Route}>
              Finalizar compra
            </Link>
            <Link
              href="/products"
              className={cn(buttonVariants({ variant: "link-muted", size: "link" }), "mt-3 flex w-full")}
            >
              Continuar comprando
            </Link>
            <p className="text-muted-foreground mt-3 text-xs">
              Preços e estoque são confirmados novamente ao finalizar a compra.
            </p>
          </Card>

          {/* Mobile/tablet: CTA sempre ao alcance do polegar; o resumo completo segue acima. */}
          <div
            data-slot="cart-sticky-checkout"
            className="bg-background/95 z-sticky-bar shadow-sticky-bar fixed inset-x-0 bottom-0 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
          >
            <div className="mx-auto flex max-w-6xl items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs">Subtotal · frete na finalização</p>
                <p className="text-base font-bold tabular-nums">{formatMoneyInCents(subtotalInCents)}</p>
              </div>
              <Link className={buttonVariants({ className: "shrink-0" })} href={"/checkout" as Route}>
                Finalizar compra
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
