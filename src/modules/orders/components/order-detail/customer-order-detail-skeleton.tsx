import { Card, CardContent } from "@/components/ui/card";
import { Skeleton, storefrontSkeletonHeightClassName } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SUMMARY_FIELD_COUNT = 4;
const SELLER_ORDER_PLACEHOLDER_COUNT = 2;

/** Loading screen of the customer order page: header, order summary and the deliveries of each store. */
export function CustomerOrderDetailSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando pedido"
      className={cn("flex min-w-0 flex-col gap-8", storefrontSkeletonHeightClassName)}
    >
      <div className="space-y-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-9 w-64 max-w-full sm:h-10" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <Card>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {Array.from({ length: SUMMARY_FIELD_COUNT }, (_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-28 max-w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-7 w-48 max-w-full" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
        {Array.from({ length: SELLER_ORDER_PLACEHOLDER_COUNT }, (_, index) => (
          <Card key={index}>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-6 w-40 max-w-full" />
                  <Skeleton className="h-4 w-32 max-w-full" />
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
      <span className="sr-only">Carregando pedido…</span>
    </div>
  );
}
