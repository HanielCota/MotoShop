import { pageContainerClassName } from "@/components/ui/page-container";
import { ProductGridSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function ProductsLoading() {
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
