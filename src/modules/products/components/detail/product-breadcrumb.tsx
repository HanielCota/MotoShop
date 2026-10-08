import Link from "next/link";
import type { Route } from "next";

export function ProductBreadcrumb({
  category,
  productName,
}: {
  category: { slug: string; label: string };
  productName: string;
}) {
  return (
    <nav aria-label="Navegação estrutural" className="text-muted-foreground min-w-0 text-xs sm:text-sm">
      <ol className="flex min-w-0 items-center gap-2">
        <li className="shrink-0">
          <Link
            href="/products"
            className="hover:text-foreground focus-visible:ring-ring/40 rounded-sm hover:underline focus-visible:ring-3 focus-visible:outline-none"
          >
            Catálogo
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li className="shrink-0">
          <Link
            href={`/categoria/${category.slug}` as Route}
            className="hover:text-foreground focus-visible:ring-ring/40 rounded-sm hover:underline focus-visible:ring-3 focus-visible:outline-none"
          >
            {category.label}
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li className="text-foreground min-w-0 truncate" aria-current="page">
          {productName}
        </li>
      </ol>
    </nav>
  );
}
