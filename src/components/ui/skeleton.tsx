import type { ComponentProps } from "react";

import { pageContainerClassName, type PageWidth } from "@/components/ui/page-container";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("bg-muted animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

/**
 * Storefront loading screens are at least one screen tall: the site footer starts below the fold
 * instead of flashing mid-screen and jumping down when the page arrives.
 */
export const storefrontSkeletonHeightClassName = "min-h-dvh";

export function PageSkeleton({
  rows = 4,
  label = "Carregando",
  size = "default",
  withSiteFooter = true,
}: {
  rows?: number;
  label?: string;
  /** Same width as the page being loaded, so the layout does not jump when content arrives. */
  size?: PageWidth;
  /** False in the seller and admin areas, which have no site footer to keep below the fold. */
  withSiteFooter?: boolean;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={pageContainerClassName(
        size,
        cn("space-y-6 py-8", withSiteFooter && storefrontSkeletonHeightClassName),
      )}
    >
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-20 w-full rounded-xl" />
        ))}
      </div>
      <span className="sr-only">{label}…</span>
    </div>
  );
}

/** Product list pages (catalog and the pages built like it): title, toolbar and the product grid. */
export function ProductListPageSkeleton() {
  return (
    <div className={pageContainerClassName("default", "space-y-6 py-8")}>
      <div className="space-y-3" aria-hidden="true">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-72 max-w-full" />
      </div>
      <div className="flex items-center justify-between gap-3" aria-hidden="true">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-44" />
      </div>
      <ProductGridSkeleton />
    </div>
  );
}

export function ProductGridSkeleton({ items = 8 }: { items?: number }) {
  return (
    <div
      role="status"
      aria-label="Carregando produtos"
      className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
    >
      {Array.from({ length: items }, (_, index) => (
        <div key={index} className="space-y-3">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-5 w-1/3" />
        </div>
      ))}
      <span className="sr-only">Carregando produtos…</span>
    </div>
  );
}
