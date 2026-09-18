import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyInCents } from "@/lib/utils";
import { getCurrentPriceInCents } from "@/modules/products/domain/pricing";
import { getPublicStorageUrl } from "@/shared/storage/public-storage-url";
import type { listApprovedProducts } from "@/modules/products/queries/products";

type ApprovedProduct = Awaited<ReturnType<typeof listApprovedProducts>>["products"][number];

export function ProductGrid({ products }: { products: ApprovedProduct[] }) {
  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">Nenhum produto aprovado corresponde aos filtros.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const variant = product.variants[0];
        const inStock = (variant?.inventory?.availableQuantity ?? 0) > 0;
        const imageUrl = product.images[0] ? getPublicStorageUrl(product.images[0].storageKey) : null;
        return (
          <Card key={product.id}>
            <Link href={`/products/${product.slug}`} className="bg-muted block overflow-hidden rounded-t-xl">
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
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/categoria/${product.category.slug}` as Route}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Badge variant="outline">{product.category.name}</Badge>
                </Link>
                <div className="flex items-center gap-2">
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
                  {variant ? formatMoneyInCents(getCurrentPriceInCents(variant)) : "Sob consulta"}
                </p>
                <p className="text-muted-foreground text-xs">
                  {inStock ? `${variant?.inventory?.availableQuantity} em estoque` : "Indisponível"}
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
