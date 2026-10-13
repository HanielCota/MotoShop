import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
export function StoreProductSearch({ storeParams }: { storeParams: StoreProductSearchParams }) {
  const preservedParams = getPreservedParams(storeParams);

  return (
    <form className="flex min-w-0 gap-2" method="get" action="#produtos" role="search" aria-label="Buscar nesta loja">
      {preservedParams.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label className="min-w-0 flex-1">
        <span className="sr-only">Buscar nesta loja</span>
        <Input
          type="search"
          className="h-12"
          name="storeProductQ"
          defaultValue={storeParams.storeProductQ ?? ""}
          placeholder="Buscar nesta loja: nome, marca, categoria ou SKU"
        />
      </label>
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
