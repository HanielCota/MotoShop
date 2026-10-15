import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProductSearchCombobox } from "@/modules/products/components/search/product-search-combobox";

/**
 * Catalog search across the full width, right below the page header. It replaces the search field of
 * the filter column and keeps the filters already applied (`preservedEntries`).
 */
export function CatalogSearchBand({
  defaultValue,
  preservedEntries,
}: {
  defaultValue: string;
  preservedEntries: [string, string][];
}) {
  return (
    <form action="/products" method="get" role="search" aria-label="Buscar no catálogo" className="flex min-w-0 gap-2">
      {preservedEntries.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label htmlFor="catalog-search" className="sr-only">
        Buscar no catálogo
      </label>
      <ProductSearchCombobox
        id="catalog-search"
        className="flex-1"
        inputClassName="h-12"
        defaultValue={defaultValue}
        placeholder="Buscar peças, acessórios ou equipamentos"
      />
      <Button type="submit" size="lg" className="h-12 px-5">
        <Search aria-hidden="true" />
        <span className="max-sm:sr-only">Buscar</span>
      </Button>
    </form>
  );
}
