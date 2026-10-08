"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";

import { DesignSelect } from "@/components/ui/design-select";

/** Ordenação do catálogo: navega imediatamente preservando os filtros atuais. */
export function CatalogSortSelect({
  value,
  options,
}: {
  value: string;
  options: { value: string; label: string; href: string }[];
}) {
  const router = useRouter();
  return (
    <label className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
      <span className="shrink-0">Ordenar por</span>
      <DesignSelect
        aria-label="Ordenar produtos"
        className="h-10 min-w-44"
        value={value}
        onValueChange={(next) => {
          const option = options.find((item) => item.value === next);
          if (option) router.push(option.href as Route, { scroll: false });
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </DesignSelect>
    </label>
  );
}
