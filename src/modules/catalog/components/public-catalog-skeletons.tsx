import { pageContainerClassName } from "@/components/ui/page-container";
import { Skeleton, storefrontSkeletonHeightClassName } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const PRODUCT_PLACEHOLDER_COUNT = 6;
const CATALOG_FILTER_FIELD_COUNT = 2;

/** Loading screen of the category, brand and motorcycle pages, in the shape of `PublicCatalogLanding`. */
export function PublicCatalogLandingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando produtos"
      className={pageContainerClassName("default", cn("flex flex-col gap-8 py-10", storefrontSkeletonHeightClassName))}
    >
      <div className="space-y-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-72 max-w-full sm:h-10" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <div className="grid min-w-0 gap-6 md:grid-cols-[260px_minmax(0,1fr)] md:items-start md:gap-8">
        <FiltersPanelSkeleton />
        <ProductResultsSkeleton />
      </div>
      <span className="sr-only">Carregando produtos…</span>
    </div>
  );
}

/** Loading screen of the public store page: the dark store banner, the product search and the shelf. */
export function PublicStoreSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando loja"
      className={pageContainerClassName(
        "default",
        cn("flex flex-col gap-8 py-8 sm:py-12", storefrontSkeletonHeightClassName),
      )}
    >
      <div className="bg-moto-brand-foreground flex min-h-[340px] flex-col justify-between gap-10 rounded-[1.75rem] p-6 sm:min-h-[390px] sm:p-10">
        <Skeleton className="h-3 w-56 max-w-full bg-white/15" />
        <div className="max-w-3xl space-y-5">
          <Skeleton className="size-16 rounded-2xl bg-white/15 sm:size-20" />
          <Skeleton className="h-10 w-full max-w-xl bg-white/15 sm:h-14" />
          <Skeleton className="h-4 w-full max-w-lg bg-white/15" />
        </div>
        <div className="flex gap-6 border-t border-white/20 pt-4">
          <Skeleton className="h-6 w-32 bg-white/15" />
          <Skeleton className="h-6 w-40 bg-white/15" />
        </div>
      </div>
      <div className="space-y-6">
        <div className="flex gap-2">
          <Skeleton className="h-12 min-w-0 flex-1 rounded-xl" />
          <Skeleton className="h-12 w-28 rounded-xl" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-7 w-52 max-w-full" />
          <Skeleton className="h-4 w-60 max-w-full" />
        </div>
        <div className="grid min-w-0 gap-6 md:grid-cols-[240px_minmax(0,1fr)] md:items-start md:gap-8">
          <FiltersPanelSkeleton />
          <ProductResultsSkeleton />
        </div>
      </div>
      <span className="sr-only">Carregando loja…</span>
    </div>
  );
}

/** Same frame as `CatalogFiltersPanel`: a closed bar on phones, the open side panel on larger screens. */
function FiltersPanelSkeleton() {
  return (
    <div className="border-border bg-card min-w-0 rounded-xl border md:p-4">
      <div className="flex min-h-12 items-center px-4 md:hidden">
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="hidden space-y-4 md:block">
        <Skeleton className="h-6 w-36" />
        {Array.from({ length: CATALOG_FILTER_FIELD_COUNT }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}

/** Result count, sort menu and product cards, with the same columns as `ProductGrid`. */
function ProductResultsSkeleton() {
  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-6 w-48 max-w-full" />
        <Skeleton className="h-10 w-44" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {Array.from({ length: PRODUCT_PLACEHOLDER_COUNT }, (_, index) => (
          <div key={index} className="space-y-3">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-5 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
