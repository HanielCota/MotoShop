"use client";

import { Bike, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { DesignSelect } from "@/components/ui/design-select";
import { cn } from "@/lib/utils";
import {
  findFirstFitmentForManufacturer,
  findFirstFitmentForModel,
  formatFitmentVariantLabel,
  getFitmentCascade,
  resolveSelectedFitment,
  type FitmentOption,
} from "@/modules/motorcycles/domain/fitment-options";
import { ProductSearchCombobox } from "@/modules/products/components/search/product-search-combobox";

const tabClassName =
  "text-muted-foreground aria-pressed:text-foreground aria-pressed:shadow-[inset_0_-3px_var(--moto-brand)] min-h-12 flex-1 px-4 text-sm font-semibold transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none";
// Rótulo flutuante dentro do gatilho do select, mantendo o alvo de toque de 56px.
const fieldClassName =
  "relative min-w-0 [&_[data-slot=select-trigger]]:h-14 [&_[data-slot=select-trigger]]:rounded-md [&_[data-slot=select-trigger]]:pt-5 [&_[data-slot=select-trigger]]:text-base";
const fieldLabelClassName =
  "text-muted-foreground pointer-events-none absolute top-2 left-3 z-10 text-xs font-bold tracking-[0.08em] uppercase";
const submitClassName = "h-14 rounded-md px-5 text-base font-bold [&_svg:not([class*=size-])]:size-5";
const helperClassName = "text-muted-foreground col-span-full text-xs leading-5 sm:text-sm";

export function MotorcycleFinder({
  fitments,
  primaryFitmentId,
}: {
  fitments: FitmentOption[];
  primaryFitmentId?: string | null | undefined;
}) {
  const router = useRouter();
  const [finderMode, setFinderMode] = useState<"motorcycle" | "search">("motorcycle");
  const [searchQuery, setSearchQuery] = useState("");
  const [fitmentId, setFitmentId] = useQueryState(
    "moto",
    parseAsString.withDefault("").withOptions({ history: "replace", shallow: true }),
  );
  const selectedFitment = resolveSelectedFitment(fitments, fitmentId, primaryFitmentId);
  const { manufacturers, models, variants } = getFitmentCascade(fitments, selectedFitment);

  async function handleFitmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFitment) return;
    // Flush the URL before leaving so Back restores the exact selection.
    await setFitmentId(selectedFitment.id);
    router.push(`/products?moto=${encodeURIComponent(selectedFitment.id)}`);
  }

  return (
    <div
      className="bg-card text-card-foreground w-full max-w-3xl scroll-mt-24 rounded-xl border border-white/20 shadow-2xl"
      id="minha-moto"
    >
      <div className="border-border flex border-b" role="group" aria-label="Forma de busca">
        <button
          className={tabClassName}
          type="button"
          aria-pressed={finderMode === "search"}
          aria-controls="marketing-search-panel"
          onClick={() => setFinderMode("search")}
        >
          Buscar produto
        </button>
        <button
          className={tabClassName}
          type="button"
          aria-pressed={finderMode === "motorcycle"}
          aria-controls="marketing-search-panel"
          onClick={() => setFinderMode("motorcycle")}
        >
          Peças por moto
        </button>
      </div>

      <div id="marketing-search-panel">
        {finderMode === "motorcycle" ? (
          <form
            className="grid gap-2.5 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.45fr)]"
            action="/products"
            autoComplete="off"
            onSubmit={handleFitmentSubmit}
          >
            <label className={fieldClassName}>
              <span className={fieldLabelClassName}>Fabricante</span>
              <DesignSelect
                aria-label="Fabricante"
                disabled={!selectedFitment}
                value={selectedFitment?.manufacturer ?? ""}
                onValueChange={(value) => {
                  void setFitmentId(findFirstFitmentForManufacturer(fitments, String(value))?.id ?? null);
                }}
              >
                {manufacturers.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </DesignSelect>
            </label>
            <label className={fieldClassName}>
              <span className={fieldLabelClassName}>Modelo</span>
              <DesignSelect
                aria-label="Modelo"
                disabled={!selectedFitment}
                value={selectedFitment?.model ?? ""}
                onValueChange={(value) => {
                  if (!selectedFitment) return;
                  void setFitmentId(
                    findFirstFitmentForModel(fitments, selectedFitment.manufacturer, String(value))?.id ?? null,
                  );
                }}
              >
                {models.map((model) => (
                  <option key={model}>{model}</option>
                ))}
              </DesignSelect>
            </label>
            <label className={cn(fieldClassName, "sm:col-span-2 lg:col-span-1")}>
              <span className={fieldLabelClassName}>Ano e versão</span>
              <DesignSelect
                aria-label="Ano e versão"
                disabled={!selectedFitment}
                name="moto"
                value={selectedFitment?.id ?? ""}
                onValueChange={(value) => {
                  void setFitmentId(String(value));
                }}
              >
                {variants.map((fitment) => (
                  <option key={fitment.id} value={fitment.id}>
                    {formatFitmentVariantLabel(fitment)}
                  </option>
                ))}
              </DesignSelect>
            </label>
            <Button type="submit" disabled={!selectedFitment} className={cn(submitClassName, "col-span-full")}>
              <Bike aria-hidden="true" /> Ver peças
            </Button>
            <p className={helperClassName}>
              {selectedFitment
                ? "Mostramos as peças compatíveis com a moto selecionada."
                : "A seleção de motos está indisponível no momento. Use a busca por produto ou explore o catálogo."}
            </p>
          </form>
        ) : (
          <form className="grid gap-2.5 p-4 sm:grid-cols-[1fr_auto]" action="/products" role="search">
            <label className="sr-only" htmlFor="home-search">
              Buscar produto
            </label>
            <div className="relative min-w-0">
              <ProductSearchCombobox
                id="home-search"
                value={searchQuery}
                onValueChange={setSearchQuery}
                placeholder="Ex.: filtro de ar"
                inputClassName="h-14 rounded-md pr-12 text-base sm:text-base [&::-webkit-search-cancel-button]:hidden"
              />
              {searchQuery ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground absolute top-1/2 right-2 -translate-y-1/2"
                  onClick={() => setSearchQuery("")}
                  aria-label="Limpar busca"
                >
                  <X aria-hidden="true" />
                </Button>
              ) : null}
            </div>
            <Button type="submit" className={submitClassName}>
              <Search aria-hidden="true" /> Buscar
            </Button>
            <p className={helperClassName}>Busque por produto, marca, loja ou código da peça.</p>
          </form>
        )}
      </div>
    </div>
  );
}
