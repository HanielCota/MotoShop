import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyInCents } from "@/lib/utils";
import { getCategoryLabel } from "@/modules/catalog/category-labels";
import { getProductOffer } from "@/modules/products/domain/product-offer";
import { hasActivePromotion } from "@/modules/products/domain/pricing";
import { getPublicStorageUrl } from "@/shared/storage/public-storage-url";
import type { listApprovedProducts } from "@/modules/products/queries/products";

type ApprovedProduct = Awaited<ReturnType<typeof listApprovedProducts>>["products"][number];

export function ProductGrid({
  products,
  emptyMessage = "Nenhum produto aprovado corresponde aos filtros.",
}: {
  products: ApprovedProduct[];
  emptyMessage?: string;
}) {
  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const offer = getProductOffer(product.variants);
        const inStock = offer.availableQuantity > 0;
        const onSale = product.variants.some(
          (variant) => hasActivePromotion(variant) && variant.promotionalPriceInCents! < variant.priceInCents,
        );
        const imageUrl = product.images[0] ? getPublicStorageUrl(product.images[0].storageKey) : null;
        return (
          <Card key={product.id}>
            <Link
              href={`/products/${product.slug}`}
              aria-label={`Ver ${product.name}`}
              className="bg-muted block overflow-hidden rounded-t-xl"
            >
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={product.images[0]?.altText ?? product.name}
                  width={640}
                  height={640}
                  unoptimized
                  className="aspect-square w-full object-cover transition-transform duration-200 hover:scale-[1.02]"
                />
              ) : (
                <div className="text-muted-foreground flex aspect-square items-center justify-center p-6 text-center text-sm">
                  Imagem não disponível
                </div>
              )}
            </Link>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/categoria/${product.category.slug}` as Route}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Badge variant="outline">{getCategoryLabel(product.category)}</Badge>
                </Link>
                <div className="flex items-center gap-2">
                  {product.isDemo ? <Badge variant="outline">Demonstração</Badge> : null}
                  {onSale ? <Badge className="border-0 bg-moto-brand text-moto-brand-foreground">Oferta</Badge> : null}
                  {product.isVip ? <Badge variant="secondary">Patrocinado · VIP</Badge> : null}
                  {product.seller.store ? (
                    <Link
                      className="text-muted-foreground hover:text-foreground text-xs"
                      href={`/loja/${product.seller.store.slug}` as Route}
                    >
                      {product.seller.store.name}
                    </Link>
                  ) : null}
                </div>
              </div>
              <CardTitle className="mt-2">
                <Link className="hover:underline" href={`/products/${product.slug}`}>
                  {product.name}
                </Link>
              </CardTitle>
              <CardDescription>
                <Link href={`/marca/${product.brand.slug}` as Route} className="hover:underline">
                  {product.brand.name}
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-end justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">
                  {offer.hasPriceRange ? <span className="block text-xs font-normal">A partir de</span> : null}
                  {offer.priceInCents !== null ? formatMoneyInCents(offer.priceInCents) : "Sob consulta"}
                </p>
                <p className="text-muted-foreground text-xs">
                  {product.isDemo
                    ? "Exemplo ilustrativo · não disponível para compra"
                    : inStock
                      ? "Em estoque · confira as variações"
                      : "Indisponível"}
                </p>
              </div>
              <Link className="text-sm font-medium underline underline-offset-4" href={`/products/${product.slug}`}>
                Detalhes
              </Link>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
