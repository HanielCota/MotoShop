"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { formatMoneyInCents } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { CheckoutSummaryItem } from "./checkout-form-model";

export function CheckoutOrderSummary({
  cartSummary,
  items = [],
  shippingTotalInCents,
  hasQuotes,
  isQuoting,
  couponCode,
  onCouponChange,
  children,
}: {
  cartSummary: { itemCount: number; itemsSubtotalInCents: number };
  items?: CheckoutSummaryItem[] | undefined;
  shippingTotalInCents: number;
  hasQuotes: boolean;
  isQuoting: boolean;
  couponCode: string;
  onCouponChange: (value: string) => void;
  /** Ações finais (alerta de erro e botão de envio), sempre visíveis. */
  children?: ReactNode | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const couponId = useId();
  const couponHintId = useId();
  const totalInCents = cartSummary.itemsSubtotalInCents + shippingTotalInCents;
  const itemLabel = `${cartSummary.itemCount} ${cartSummary.itemCount === 1 ? "item" : "itens"}`;

  return (
    <aside
      aria-labelledby="checkout-summary-title"
      className="bg-card h-fit min-w-0 rounded-xl border p-4 sm:p-6 lg:sticky lg:top-24"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="checkout-summary-title" className="text-lg font-semibold">
          Resumo do pedido
        </h2>
        <button
          type="button"
          className="text-brand-strong -mr-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium lg:hidden"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Ocultar detalhes" : "Ver detalhes"}
          <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", expanded && "rotate-180")} />
        </button>
      </div>
      <p className="text-muted-foreground mt-1 text-xs">{itemLabel}</p>

      <div id={detailsId} className={cn("mt-4 space-y-4", !expanded && "max-lg:hidden")}>
        {items.length > 0 ? (
          <ul className="space-y-2 border-b pb-4 text-sm" aria-label="Itens do pedido">
            {items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="line-clamp-2">
                    {item.quantity}× {item.name}
                  </span>
                  <span className="text-muted-foreground block text-xs">{item.variant}</span>
                </span>
                <span className="shrink-0 tabular-nums">{formatMoneyInCents(item.lineTotalInCents)}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-col gap-2">
          <label htmlFor={couponId} className="text-sm font-medium">
            Cupom de desconto (opcional)
          </label>
          <Input
            id={couponId}
            name="couponCode"
            value={couponCode}
            autoComplete="off"
            maxLength={40}
            aria-describedby={couponHintId}
            onChange={(event) => onCouponChange(event.target.value.toUpperCase())}
            placeholder="Ex.: TRILHA10"
          />
          <p id={couponHintId} className="text-muted-foreground text-xs">
            O desconto é validado e aplicado na finalização do pedido.
          </p>
        </div>
      </div>

      <dl className="bg-surface-sunken mt-4 space-y-2 rounded-lg p-3 text-sm">
        <div className={cn("flex items-center justify-between gap-3", !expanded && "max-lg:hidden")}>
          <dt>Subtotal ({itemLabel})</dt>
          <dd className="tabular-nums">{formatMoneyInCents(cartSummary.itemsSubtotalInCents)}</dd>
        </div>
        <div className={cn("flex items-center justify-between gap-3", !expanded && "max-lg:hidden")}>
          <dt>Frete</dt>
          <dd className="text-right tabular-nums">
            {isQuoting ? "Calculando…" : hasQuotes ? formatMoneyInCents(shippingTotalInCents) : "Informe o CEP"}
          </dd>
        </div>
        {couponCode.trim() ? (
          <div className={cn("flex items-center justify-between gap-3", !expanded && "max-lg:hidden")}>
            <dt>Desconto ({couponCode.trim()})</dt>
            <dd className="text-muted-foreground text-right text-xs">Aplicado na finalização</dd>
          </div>
        ) : null}
        <div className="border-border flex items-center justify-between gap-3 border-t pt-2 text-base font-semibold">
          <dt>{hasQuotes ? "Total estimado" : "Total sem frete"}</dt>
          <dd className="tabular-nums">{formatMoneyInCents(totalInCents)}</dd>
        </div>
      </dl>

      {children}
    </aside>
  );
}
