import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyInCents } from "@/lib/utils";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { FavoriteButton } from "@/modules/favorites/components/favorite-button";
import { listFavoriteProducts } from "@/modules/favorites/queries/favorites";
import { loadFavoriteSearchParams } from "@/modules/favorites/search-params";
import { getCurrentPriceInCents } from "@/modules/products/domain/pricing";
import { getPublicStorageUrl } from "@/shared/storage/public-storage-url";

export default async function FavoritesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAuthenticatedUser("/favorites");
  const params = await loadFavoriteSearchParams(searchParams);
  const result = await listFavoriteProducts(session.user.id, {
    query: params.favoriteQ,
    availability: params.favoriteAvailability,
    sort: params.favoriteSort,
    page: params.favoritePage,
  });

  function pageHref(page: number): Route {
    const query = new URLSearchParams();
    if (params.favoriteQ) query.set("favoriteQ", params.favoriteQ);
    if (params.favoriteAvailability !== "ALL") query.set("favoriteAvailability", params.favoriteAvailability);
    if (params.favoriteSort !== "newest") query.set("favoriteSort", params.favoriteSort);
    if (page > 1) query.set("favoritePage", String(page));
    const serialized = query.toString();
    return (serialized ? `/favorites?${serialized}` : "/favorites") as Route;
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <div>
        <Badge variant="secondary">Minha conta</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Meus favoritos</h1>
        <p className="text-muted-foreground mt-3">Guarde produtos para revisitar antes da próxima sessão.</p>
      </div>

      <form className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_180px_180px_auto] sm:items-end" method="get">
        <label className="flex flex-col gap-2 text-sm font-medium">
          Buscar favorito
          <input
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
            name="favoriteQ"
            defaultValue={params.favoriteQ ?? ""}
            placeholder="Produto, marca ou loja"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Disponibilidade
          <select className="border-input bg-background h-10 rounded-md border px-3 text-sm" name="favoriteAvailability" defaultValue={params.favoriteAvailability}>
            <option value="ALL">Todos</option>
            <option value="IN_STOCK">Em estoque</option>
            <option value="OUT_OF_STOCK">Indisponíveis</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Ordenação
          <select className="border-input bg-background h-10 rounded-md border px-3 text-sm" name="favoriteSort" defaultValue={params.favoriteSort}>
            <option value="newest">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
          </select>
        </label>
        <button className="bg-primary text-primary-foreground h-10 rounded-md px-4 text-sm font-medium">Filtrar</button>
      </form>

      {result.favorites.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-muted-foreground">Você ainda não favoritou nenhum produto.</p>
            <Link href="/products" className="text-primary font-medium underline underline-offset-4">
              Explorar produtos
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.favorites.map(({ product }) => {
            const variant = product.variants[0];
            const imageUrl = product.images[0] ? getPublicStorageUrl(product.images[0].storageKey) : null;
            const inStock = (variant?.inventory?.availableQuantity ?? 0) > 0;

            return (
              <Card key={product.id} className="overflow-hidden">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={product.images[0]?.altText ?? product.name}
                    width={640}
                    height={360}
                    unoptimized
                    className="aspect-video w-full object-cover"
                  />
                ) : null}
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline">{product.category.name}</Badge>
                    <span className="text-muted-foreground text-xs">{product.seller.store?.name}</span>
                  </div>
                  <CardTitle>
                    <Link className="hover:underline" href={`/products/${product.slug}`}>
                      {product.name}
                    </Link>
                  </CardTitle>
                  <CardDescription>{product.brand.name}</CardDescription>
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
                  <FavoriteButton productId={product.id} initialIsFavorite />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {result.pageCount > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label="Paginação de favoritos">
          {result.page > 1 ? <Link href={pageHref(result.page - 1)} className="rounded-md border px-3 py-2 text-sm">Anterior</Link> : <span />}
          <span className="text-muted-foreground text-sm">Página {result.page} de {result.pageCount} · {result.total} favorito(s)</span>
          {result.page < result.pageCount ? <Link href={pageHref(result.page + 1)} className="rounded-md border px-3 py-2 text-sm">Próxima</Link> : <span />}
        </nav>
      ) : null}
    </main>
  );
}
