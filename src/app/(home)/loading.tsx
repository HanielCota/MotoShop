import { pageContainerClassName } from "@/components/ui/page-container";
import { ProductGridSkeleton, Skeleton, storefrontSkeletonHeightClassName } from "@/components/ui/skeleton";

// The home sits in its own route group so this screen covers only "/", not every page of the site.
export default function HomeLoading() {
  return (
    <div className={storefrontSkeletonHeightClassName}>
      <Skeleton className="h-[420px] w-full rounded-none sm:h-[470px]" />
      <div className={pageContainerClassName("default", "space-y-6 py-10")}>
        <Skeleton className="h-8 w-64 max-w-full" />
        <ProductGridSkeleton items={4} />
      </div>
    </div>
  );
}
