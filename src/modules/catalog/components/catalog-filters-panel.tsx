"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Painel de filtros do catálogo: recolhido no topo da página no mobile
 * (antes da grade) e sempre aberto como barra lateral no desktop.
 * Um único formulário é renderizado para evitar campos duplicados.
 */
export function CatalogFiltersPanel({
  activeCount,
  defaultOpen = false,
  children,
}: {
  activeCount: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const titleId = useId();

  return (
    <aside
      aria-labelledby={titleId}
      className="border-border bg-card min-w-0 rounded-xl border md:sticky md:top-24 md:p-4"
    >
      <h2 id={titleId} className="sr-only md:not-sr-only md:mb-3 md:block md:text-lg">
        Filtrar produtos
      </h2>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="focus-visible:ring-ring/40 flex min-h-12 w-full items-center justify-between gap-2 rounded-xl px-4 text-sm font-semibold focus-visible:ring-3 focus-visible:outline-none md:hidden"
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          Filtrar produtos
          {activeCount > 0 ? (
            <span className="bg-moto-brand text-moto-brand-foreground rounded-full px-2 py-0.5 text-xs">
              {activeCount}
              <span className="sr-only"> {activeCount === 1 ? "filtro ativo" : "filtros ativos"}</span>
            </span>
          ) : null}
        </span>
        <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      <div id={panelId} className={cn("border-border border-t p-4 md:block md:border-0 md:p-0", !open && "max-md:hidden")}>
        {children}
      </div>
    </aside>
  );
}
