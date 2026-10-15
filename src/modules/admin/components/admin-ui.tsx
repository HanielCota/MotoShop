import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Card padrão das seções do Admin: o título é `h2` porque o `h1` vem do PageHeader da página. */
export function AdminCard({
  id,
  title,
  description,
  actions,
  children,
  contentClassName,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <Card id={id} aria-labelledby={headingId} className="min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 id={headingId} className="text-base leading-snug font-semibold">
              {title}
            </h2>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </CardHeader>
      <CardContent className={cn("min-w-0 space-y-4", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

// Filtros GET promovidos para components/ui (DS-04); os nomes antigos continuam valendo no Admin.
export {
  FilterDateRange,
  FilterField,
  FilterForm as AdminFilterForm,
  FilterSelect,
  FilterText,
} from "@/components/ui/filter-form";

export const newestFirstSortOptions = [
  { value: "newest", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
] as const;

export const oldestFirstSortOptions = [
  { value: "oldest", label: "Mais antigos" },
  { value: "newest", label: "Mais recentes" },
] as const;

export function sellerFilterOptions(sellers: readonly { id: string; store: { name: string } | null }[]) {
  return [
    { value: "", label: "Todos os lojistas" },
    ...sellers.map((seller) => ({ value: seller.id, label: seller.store?.name ?? "Sem loja" })),
  ];
}

/** Tabela responsiva: rola horizontalmente no mobile sem estourar a página. */
export function AdminTable({
  caption,
  columns,
  children,
  minWidth = "min-w-[720px]",
}: {
  caption: string;
  columns: readonly string[];
  children: ReactNode;
  minWidth?: string;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className={cn("w-full border-collapse text-left text-sm", minWidth)}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-muted-foreground border-b text-xs uppercase">
            {columns.map((column) => (
              <th key={column} scope="col" className="px-2 py-2 font-semibold tracking-wide first:pl-0 last:pr-0">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-border divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export const cellClassName = "px-2 py-3 align-top first:pl-0 last:pr-0";

/** Lista simples de registros em cartões empilhados (quando o conteúdo não cabe numa tabela). */
export function AdminList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="divide-border divide-y">
      {children}
    </ul>
  );
}
