import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

type PaginationProps = {
  page: number;
  pageCount: number;
  previousHref?: ComponentProps<typeof Link>["href"];
  nextHref?: ComponentProps<typeof Link>["href"];
  ariaLabel: string;
  summary?: ReactNode;
  className?: string;
};

export function Pagination({
  page,
  pageCount,
  previousHref,
  nextHref,
  ariaLabel,
  summary,
  className,
}: PaginationProps) {
  if (pageCount <= 1) return null;

  const linkClassName =
    "border-border bg-background text-foreground hover:bg-muted focus-visible:ring-ring/40 inline-flex min-h-10 items-center rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-3";

  return (
    <nav
      className={cn("grid grid-cols-2 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]", className)}
      aria-label={ariaLabel}
    >
      <div className="row-start-2 justify-self-start sm:row-start-1">
        {page > 1 && previousHref ? (
          <Link href={previousHref} className={linkClassName}>
            Anterior
          </Link>
        ) : null}
      </div>
      <span className="text-muted-foreground col-span-2 row-start-1 text-center text-sm sm:col-span-1 sm:col-start-2">
        Página {page} de {pageCount}
        {summary ? <> · {summary}</> : null}
      </span>
      <div className="col-start-2 row-start-2 justify-self-end sm:col-start-3 sm:row-start-1">
        {page < pageCount && nextHref ? (
          <Link href={nextHref} className={linkClassName}>
            Próxima
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
