import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { DateFilterInput } from "@/components/ui/date-filter-input";
import { DesignSelect } from "@/components/ui/design-select";
import { Input } from "@/components/ui/input";
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

/** Formulário GET de filtros com layout consistente entre as seções. */
export function AdminFilterForm({
  resetHref,
  children,
  label = "Filtros",
}: {
  resetHref: Route;
  children: ReactNode;
  label?: string;
}) {
  return (
    <form
      method="get"
      aria-label={label}
      className="bg-surface-sunken/60 grid min-w-0 gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
    >
      {children}
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end">
        <Button type="submit" size="sm" className="px-4">
          Filtrar
        </Button>
        <Link href={resetHref} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Limpar filtros
        </Link>
      </div>
    </form>
  );
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

export function FilterText({
  label,
  name,
  value,
  placeholder,
}: {
  label: string;
  name: string;
  value: string | null | undefined;
  placeholder?: string;
}) {
  return (
    <FilterField label={label}>
      <Input className="h-9" name={name} defaultValue={value ?? ""} placeholder={placeholder} />
    </FilterField>
  );
}

export function FilterSelect({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <FilterField label={label}>
      <DesignSelect aria-label={label} className="h-9" name={name} defaultValue={value}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </DesignSelect>
    </FilterField>
  );
}

export function FilterDateRange({
  fromName,
  toName,
  from,
  to,
}: {
  fromName: string;
  toName: string;
  from: string | null | undefined;
  to: string | null | undefined;
}) {
  return (
    <>
      <FilterField label="De">
        <DateFilterInput className="h-9" name={fromName} value={from ?? null} />
      </FilterField>
      <FilterField label="Até">
        <DateFilterInput className="h-9" name={toName} value={to ?? null} />
      </FilterField>
    </>
  );
}

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
