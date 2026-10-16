import { SearchForm } from "@/modules/products/components/search/search-form";

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
    <SearchForm
      action="/products"
      label="Buscar no catálogo"
      inputId="catalog-search"
      defaultValue={defaultValue}
      preservedEntries={preservedEntries}
      placeholder="Buscar peças"
      iconOnlyOnPhone
    />
  );
}
