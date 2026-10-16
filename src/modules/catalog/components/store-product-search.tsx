import { SearchForm } from "@/modules/products/components/search/search-form";

type StoreProductSearchParams = {
  storeProductQ: string | null;
  storeProductAvailability: string;
  storeProductPromotion: string;
  storeProductSort: string;
  storeReviewPage: number;
  storeReviewSort: string;
};

/**
 * Store-wide search shown right below the store header. A new search starts at the first product page
 * and keeps the other filters, the product sort and the reviews position.
 */
export function StoreProductSearch({
  storeParams,
  sellerId,
}: {
  storeParams: StoreProductSearchParams;
  /** Suggestions while typing stay inside this store. */
  sellerId: string;
}) {
  const preservedParams = getPreservedParams(storeParams);

  return (
    <SearchForm
      action="#produtos"
      label="Buscar nesta loja"
      inputId="store-product-search"
      name="storeProductQ"
      defaultValue={storeParams.storeProductQ ?? ""}
      preservedEntries={preservedParams}
      placeholder="Buscar nesta loja: nome, marca, categoria ou SKU"
      sellerId={sellerId}
      iconOnlyOnPhone
    />
  );
}

function getPreservedParams(storeParams: StoreProductSearchParams): [string, string][] {
  const entries: [string, string | null][] = [
    [
      "storeProductAvailability",
      storeParams.storeProductAvailability === "ALL" ? null : storeParams.storeProductAvailability,
    ],
    ["storeProductPromotion", storeParams.storeProductPromotion === "ALL" ? null : storeParams.storeProductPromotion],
    ["storeProductSort", storeParams.storeProductSort === "relevance" ? null : storeParams.storeProductSort],
    ["storeReviewPage", storeParams.storeReviewPage > 1 ? String(storeParams.storeReviewPage) : null],
    ["storeReviewSort", storeParams.storeReviewSort === "newest" ? null : storeParams.storeReviewSort],
  ];

  return entries.filter((entry): entry is [string, string] => entry[1] !== null);
}
