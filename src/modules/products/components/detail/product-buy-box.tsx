"use client";

import { useState, type ReactNode } from "react";

import { DesignRadio, DesignRadioGroup } from "@/components/ui/design-radio";
import { formatMoneyInCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AddToCartButton } from "@/modules/cart/components/add-to-cart-button";

export type BuyBoxVariant = {
  id: string;
  title: string;
  sku: string;
  priceInCents: number;
  currentPriceInCents: number;
  onSale: boolean;
  stock: number;
};

const LOW_STOCK_THRESHOLD = 5;

export function ProductBuyBox({
  variants,
  isDemo,
  hasPriceRange,
  fitment,
}: {
  variants: BuyBoxVariant[];
  isDemo: boolean;
  hasPriceRange: boolean;
  /** Faixa "Minha Moto", renderizada no servidor e posicionada antes da escolha de opção. */
  fitment?: ReactNode;
}) {
  const initial = variants.find((variant) => variant.stock > 0) ?? variants[0];
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");
  const selected = variants.find((variant) => variant.id === selectedId) ?? initial;

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
            <span className="text-brand-strong font-semibold">Preço promocional</span>
          </p>
        ) : null}
        {isDemo ? <p className="text-brand-strong mt-1 text-xs font-medium">Valor ilustrativo</p> : null}
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
              const unavailable = !isDemo && variant.stock < 1;
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
                      {unavailable ? " · Indisponível" : ""}
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

      <div className="space-y-1 text-xs">
        <p className="text-muted-foreground">
          {isDemo
            ? `SKU ${selected.sku} · exemplo ilustrativo`
            : `SKU ${selected.sku} · ${selected.stock > 0 ? `${selected.stock} em estoque` : "Indisponível"}`}
        </p>
        {!isDemo && selected.stock > 0 && selected.stock <= LOW_STOCK_THRESHOLD ? (
          <p className="text-warning-foreground font-semibold">
            Restam {selected.stock} {selected.stock === 1 ? "unidade" : "unidades"} desta opção
          </p>
        ) : null}
      </div>

      {!isDemo ? (
        <AddToCartButton
          key={selected.id}
          variantId={selected.id}
          disabled={selected.stock < 1}
          stickyBar={{
            price: formatMoneyInCents(selected.currentPriceInCents),
            option: variants.length > 1 ? selected.title : undefined,
          }}
        />
      ) : null}
    </div>
  );
}
