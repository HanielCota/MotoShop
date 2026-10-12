import { Skeleton } from "@/components/ui/skeleton";

export function ProductDetailSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando produto"
      className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12"
    >
      <Skeleton className="h-4 w-64 max-w-full" />
      <div className="grid gap-5 md:grid-cols-2 lg:gap-8">
        <Skeleton className="aspect-[6/5] w-full rounded-3xl sm:aspect-square" />
        <div className="border-border bg-card space-y-4 rounded-3xl border p-5 sm:p-7">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-9 w-4/5" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <div className="grid gap-2 sm:grid-cols-2">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <span className="sr-only">Carregando produto…</span>
    </div>
  );
}
