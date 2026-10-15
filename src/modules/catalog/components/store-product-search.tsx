import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProductSearchCombobox } from "@/modules/products/components/search/product-search-combobox";

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
    <form className="flex min-w-0 gap-2" method="get" action="#produtos" role="search" aria-label="Buscar nesta loja">
      {preservedParams.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label htmlFor="store-product-search" className="sr-only">
        Buscar nesta loja
      </label>
      <ProductSearchCombobox
        id="store-product-search"
        name="storeProductQ"
        className="flex-1"
        inputClassName="h-12"
        defaultValue={storeParams.storeProductQ ?? ""}
        placeholder="Buscar nesta loja: nome, marca, categoria ou SKU"
        sellerId={sellerId}
      />
      <Button type="submit" size="lg" className="h-12 px-5">
        <Search aria-hidden="true" />
        <span className="max-sm:sr-only">Buscar</span>
      </Button>
    </form>
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
