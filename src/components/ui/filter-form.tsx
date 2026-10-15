import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { DateFilterInput } from "@/components/ui/date-filter-input";
import { DesignSelect } from "@/components/ui/design-select";
import { Input } from "@/components/ui/input";

/** Formulário GET de filtros com layout consistente entre as seções. */
export function FilterForm({
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
      <Input size="sm" name={name} defaultValue={value ?? ""} placeholder={placeholder} />
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
      <DesignSelect aria-label={label} size="sm" name={name} defaultValue={value}>
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
        <DateFilterInput size="sm" name={fromName} value={from ?? null} />
      </FilterField>
      <FilterField label="Até">
        <DateFilterInput size="sm" name={toName} value={to ?? null} />
      </FilterField>
    </>
  );
}
