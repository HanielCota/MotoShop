import type { Route } from "next";
import Link from "next/link";

import { SearchForm } from "@/modules/products/components/search/search-form";

/** Ready searches shown before the first search; each has products in the catalog. */
export const catalogSearchExamples = ["Capacete", "Bota", "Disco de freio", "Óculos"] as const;

const exampleLinkClassName =
  "border-border bg-card text-foreground hover:border-moto-brand focus-visible:ring-moto-brand/40 inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none";

/**
 * Catalog search across the full width, right below the page header. It replaces the search field of
 * the filter column and keeps the filters already applied (`preservedEntries`). The field carries
 * the brand border and an example phrase so it does not look disabled.
 */
export function CatalogSearchBand({
  defaultValue,
  preservedEntries,
}: {
  defaultValue: string;
  preservedEntries: [string, string][];
}) {
  return (
    <div>
      <SearchForm
        action="/products"
        label="Buscar no catálogo"
        inputId="catalog-search"
        defaultValue={defaultValue}
        preservedEntries={preservedEntries}
        placeholder="Busque por peça, marca ou moto. Ex.: pastilha de freio CRF 250R"
        inputClassName="border-moto-brand bg-card border-2 shadow-[0_2px_8px_rgb(255_106_0/0.15)]"
        iconOnlyOnPhone
      />
      {defaultValue.trim().length > 0 ? null : <CatalogSearchExamples preservedEntries={preservedEntries} />}
    </div>
  );
}

function CatalogSearchExamples({ preservedEntries }: { preservedEntries: [string, string][] }) {
  return (
    <nav aria-label="Sugestões de busca" className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Experimente:</span>
      {catalogSearchExamples.map((example) => (
        <Link key={example} href={buildExampleHref(example, preservedEntries)} className={exampleLinkClassName}>
          {example}
        </Link>
      ))}
    </nav>
  );
}

/** Same address the search form would send: the applied filters plus the example as the search. */
function buildExampleHref(example: string, preservedEntries: [string, string][]): Route {
  const params = new URLSearchParams(preservedEntries.filter(([name]) => name !== "q"));
  params.set("q", example);

  return `/products?${params.toString()}` as Route;
}
