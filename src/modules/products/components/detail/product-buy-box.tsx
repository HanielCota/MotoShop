"use client";

import { useState, type ReactNode } from "react";

import { DesignRadio, DesignRadioGroup } from "@/components/ui/design-radio";
import { formatMoneyInCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AddToCartButton } from "@/modules/cart/components/add-to-cart-button";
import { getPublicStockStatus } from "@/modules/products/domain/stock-status";

export type BuyBoxVariant = {
  id: string;
  title: string;
  sku: string;
  priceInCents: number;
  currentPriceInCents: number;
  onSale: boolean;
  stock: number;
};

export function ProductBuyBox({
  variants,
  hasPriceRange,
  fitment,
}: {
  variants: BuyBoxVariant[];
  hasPriceRange: boolean;
  /** Faixa "Minha Moto", renderizada no servidor e posicionada antes da escolha de opção. */
  fitment?: ReactNode;
}) {
  const initial = variants.find((variant) => variant.stock > 0) ?? variants[0];
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");
  const selected = variants.find((variant) => variant.id === selectedId) ?? initial;
  const stockStatus = selected ? getPublicStockStatus(selected.stock) : "out-of-stock";
  const discountPercentage =
    selected?.onSale && selected.priceInCents > 0
      ? Math.round(((selected.priceInCents - selected.currentPriceInCents) / selected.priceInCents) * 100)
      : 0;

  if (!selected) {
    return <p className="text-muted-foreground mt-6 text-sm">Este produto está sem opções disponíveis no momento.</p>;
  }

  return (
    <div className="mt-6 space-y-5">
      <div aria-live="polite">
        {hasPriceRange && variants.length > 1 ? (
          <p className="text-muted-foreground text-xs">Preço da opção selecionada</p>
        ) : null}
        <p className="text-foreground font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          {formatMoneyInCents(selected.currentPriceInCents)}
        </p>
        {selected.onSale ? (
          <p className="text-muted-foreground mt-1 text-sm">
            <span className="sr-only">Preço anterior: </span>
            <span className="mr-2 line-through">{formatMoneyInCents(selected.priceInCents)}</span>
            {/* Keeps screen readers from reading the old price and the offer as one word. */}
            <span className="sr-only">. </span>
            <span className="text-brand-strong font-semibold">
              Oferta{discountPercentage > 0 ? ` · ${discountPercentage}% de desconto` : ""}
            </span>
          </p>
        ) : null}
      </div>

      {fitment}

      {variants.length > 1 ? (
        <fieldset className="space-y-2">
          <legend className="mb-2 flex w-full items-end justify-between gap-3">
            <span className="text-foreground text-sm font-semibold">Escolha sua opção</span>
            <span className="text-muted-foreground text-xs font-normal">{variants.length} opções</span>
          </legend>
          <DesignRadioGroup
            label="Opções do produto"
            name="variantId"
            value={selected.id}
            onValueChange={setSelectedId}
            className="grid gap-2 sm:grid-cols-2"
          >
            {variants.map((variant) => {
              const unavailable = variant.stock < 1;
              const checked = variant.id === selected.id;
              return (
                <label
                  key={variant.id}
                  className={cn(
                    "flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-3 transition-[border-color,background-color]",
                    "has-[:focus-visible]:ring-ring/40 has-[:focus-visible]:ring-3",
                    checked
                      ? "border-moto-brand bg-moto-brand-surface"
                      : "border-border bg-card hover:border-foreground/30",
                    unavailable && "opacity-70",
                  )}
                >
                  <DesignRadio value={variant.id} className="mt-0.5" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-foreground text-sm font-semibold">{variant.title}</span>
                    <span className="text-muted-foreground text-xs">
                      {formatMoneyInCents(variant.currentPriceInCents)}
                      {unavailable ? " · Esgotado" : ""}
                    </span>
                  </span>
                </label>
              );
            })}
          </DesignRadioGroup>
        </fieldset>
      ) : (
        <p className="text-foreground text-sm">
          <span className="text-muted-foreground">Opção: </span>
          <span className="font-semibold">{selected.title}</span>
        </p>
      )}

      <div className="space-y-2 text-xs" aria-live="polite">
        {stockStatus === "last-units" ? (
          <p className="border-warning/40 bg-warning-surface text-warning-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold">
            Últimas unidades · {selected.stock === 1 ? "resta 1" : `restam ${selected.stock}`}
          </p>
        ) : null}
        {stockStatus === "out-of-stock" ? (
          <p className="border-border bg-surface-sunken text-foreground inline-flex rounded-full border px-3 py-1 text-sm font-semibold">
            Esgotado
          </p>
        ) : null}
        <p className="text-muted-foreground">
          {`SKU ${selected.sku}${stockStatus === "in-stock" ? ` · ${selected.stock} em estoque` : ""}`}
        </p>
      </div>

      <AddToCartButton
        key={selected.id}
        variantId={selected.id}
        disabled={selected.stock < 1}
        stickyBar={{
          price: formatMoneyInCents(selected.currentPriceInCents),
          option: variants.length > 1 ? selected.title : undefined,
        }}
      />
    </div>
  );
}
