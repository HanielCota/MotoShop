import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyInCents } from "@/lib/utils";
import { CartItemControls } from "@/modules/cart/components/cart-item-controls";
import { getActiveCart } from "@/modules/cart/queries/cart";
import { getCurrentPriceInCents } from "@/modules/products/domain/pricing";

export default async function CartPage() {
  const cart = await getActiveCart();
  const items = cart?.items ?? [];
  const groups = Map.groupBy(items, (item) => item.variant.product.sellerId);
  const subtotalInCents = items.reduce(
    (total, item) => total + getCurrentPriceInCents(item.variant) * item.quantity,
    0,
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div>
        <p className="text-muted-foreground text-sm">Sua compra</p>
        <h1 className="text-3xl font-semibold tracking-tight">Carrinho</h1>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Seu carrinho está vazio</CardTitle>
            <CardDescription>Encontre peças, equipamentos e acessórios para sua próxima sessão.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link className={buttonVariants()} href="/products">
              Explorar produtos
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-4">
            {Array.from(groups.entries()).map(([sellerId, sellerItems]) => (
              <Card key={sellerId}>
                <CardHeader>
                  <CardTitle>{sellerItems[0]?.variant.product.store.name}</CardTitle>
                  <CardDescription>Itens deste lojista serão enviados juntos quando possível.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {sellerItems.map((item) => {
                    const unitPriceInCents = getCurrentPriceInCents(item.variant);
                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-medium">{item.variant.product.name}</p>
                          <p className="text-muted-foreground text-sm">
                            {item.variant.title} · SKU {item.variant.sku}
                          </p>
                          <p className="mt-1 text-sm">{formatMoneyInCents(unitPriceInCents)} por unidade</p>
                        </div>
                        <CartItemControls cartItemId={item.id} quantity={item.quantity} />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Resumo</CardTitle>
              <CardDescription>Frete e disponibilidade serão recalculados no checkout.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <strong>{formatMoneyInCents(subtotalInCents)}</strong>
              </div>
              <Link className={buttonVariants({ className: "w-full" })} href={"/checkout" as import("next").Route}>
                Continuar para checkout
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
