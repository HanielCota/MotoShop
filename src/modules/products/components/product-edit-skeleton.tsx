import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Loading screen of the seller's product edit page: header with status, the product form and the submit card. */
export function ProductEditSkeleton() {
  return (
    <div role="status" aria-label="Carregando produto" className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-56 max-w-full sm:h-10" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Card>
        <CardContent className="space-y-5">
          <Skeleton className="h-8 w-full" />
          <FieldSkeleton />
          <div className="sm:w-1/2">
            <FieldSkeleton />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-28 w-full" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldSkeleton />
            <FieldSkeleton />
          </div>
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>
          <Skeleton className="h-10 w-44" />
        </CardContent>
      </Card>
      <span className="sr-only">Carregando produto…</span>
    </div>
  );
}

function FieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}
