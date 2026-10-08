import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { DesignSelect } from "@/components/ui/design-select";
import Link from "next/link";
import type { Route } from "next";

import { Heart, SearchX } from "lucide-react";

import { ProductCard } from "@/components/storefront/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { FavoriteButton } from "@/modules/favorites/components/favorite-button";
import { listFavoriteProducts } from "@/modules/favorites/queries/favorites";
import { loadFavoriteSearchParams } from "@/modules/favorites/search-params";
import { toProductCardData } from "@/modules/products/components/product-grid";
import { CustomerAccountNavigation } from "@/modules/customers/components/customer-account-navigation";

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
  const hasFilters = Boolean(
    params.favoriteQ?.trim() || params.favoriteAvailability !== "ALL" || params.favoriteSort !== "newest",
  );
  const allFavorites = hasFilters ? await listFavoriteProducts(session.user.id, { pageSize: 1 }) : result;

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
      <PageHeader
        eyebrow="Minha conta"
        title="Meus favoritos"
        description="Guarde produtos para revisitar antes da próxima sessão."
      />

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <CustomerAccountNavigation pathname="/favorites" />
      <div className="min-w-0 space-y-6">
      <form
        className="border-border bg-card grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_180px_180px_auto] sm:items-end [&_[data-slot=select-trigger]]:h-11 [&_[data-slot=select-trigger]]:w-full"
        method="get"
      >
        <label className="flex flex-col gap-2 text-sm font-medium">
          Buscar favorito
          <Input type="search" className="h-11" name="favoriteQ" defaultValue={params.favoriteQ ?? ""} placeholder="Produto, marca ou loja" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Disponibilidade
          <DesignSelect
            aria-label="Disponibilidade"
            name="favoriteAvailability"
            defaultValue={params.favoriteAvailability}
          >
            <option value="ALL">Todos</option>
            <option value="IN_STOCK">Em estoque</option>
            <option value="OUT_OF_STOCK">Indisponíveis</option>
          </DesignSelect>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Ordenação
          <DesignSelect aria-label="Ordenação" name="favoriteSort" defaultValue={params.favoriteSort}>
            <option value="newest">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
          </DesignSelect>
        </label>
        <Button type="submit" size="lg" className="px-4">
          Filtrar
        </Button>
        {hasFilters ? (
          <Link
            href="/favorites"
            className="text-brand-strong inline-flex min-h-10 items-center self-center text-sm underline underline-offset-4 sm:col-span-full"
          >
            Limpar filtros
          </Link>
        ) : null}
      </form>

      {result.favorites.length === 0 ? (
        hasFilters && allFavorites.total > 0 ? (
          <EmptyState
            icon={SearchX}
            title="Nenhum favorito encontrado"
            description="Nenhum favorito corresponde aos filtros selecionados."
            action={{ label: "Limpar filtros", href: "/favorites" }}
          />
        ) : (
          <EmptyState
            icon={Heart}
            title="Nenhum favorito ainda"
            description="Você ainda não favoritou nenhum produto."
            action={{ label: "Explorar produtos", href: "/products" }}
          />
        )
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {result.favorites.map(({ product }, index) => (
            <li key={product.id} className="flex min-w-0">
              <ProductCard
                product={toProductCardData(product)}
                eager={index === 0}
                headingLevel="h2"
                action={<FavoriteButton productId={product.id} initialIsFavorite />}
              />
            </li>
          ))}
        </ul>
      )}
      {result.pageCount > 1 ? (
        <Pagination
          ariaLabel="Paginação de favoritos"
          page={result.page}
          pageCount={result.pageCount}
          previousHref={pageHref(result.page - 1)}
          nextHref={pageHref(result.page + 1)}
          summary={<>{result.total} {result.total === 1 ? "favorito" : "favoritos"}</>}
        />
      ) : null}
      </div>
      </div>
    </main>
  );
}
