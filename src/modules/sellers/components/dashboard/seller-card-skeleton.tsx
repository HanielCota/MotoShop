import { Skeleton } from "@/components/ui/skeleton";
import { overviewStatsGridClassName } from "@/modules/sellers/domain/dashboard-grid";

/** Placeholder de card usado como fallback de <Suspense> na Central do Lojista. */
export function SellerCardSkeleton({ rows = 3, label = "Carregando" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="bg-card ring-foreground/10 space-y-4 rounded-xl p-5 ring-1">
      <Skeleton className="h-5 w-48 max-w-full" />
      <Skeleton className="h-4 w-72 max-w-full" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function SellerStatsSkeleton({ items = 4 }: { items?: number }) {
  return (
    <div role="status" aria-label="Carregando indicadores" className={overviewStatsGridClassName(items)}>
      {Array.from({ length: items }, (_, index) => (
        <Skeleton key={index} className="h-28 w-full rounded-xl" />
      ))}
      <span className="sr-only">Carregando indicadores…</span>
    </div>
  );
}
