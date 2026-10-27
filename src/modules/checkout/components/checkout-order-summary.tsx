"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, useTransition, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatMoneyInCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CartItemThumbnail } from "@/modules/cart/components/cart-item-thumbnail";

import type { CouponPreviewState } from "../actions/checkout-actions";
import type { CheckoutSummaryItem } from "./checkout-form-model";

type AppliedCoupon = { code: string; discountInCents: number };

export function CheckoutOrderSummary({
  cartSummary,
  items = [],
  shippingTotalInCents,
  hasQuotes,
  isQuoting,
  couponCode,
  onCouponChange,
  onApplyCoupon,
  children,
}: {
  cartSummary: { itemCount: number; itemsSubtotalInCents: number };
  items?: CheckoutSummaryItem[] | undefined;
  shippingTotalInCents: number;
  hasQuotes: boolean;
  isQuoting: boolean;
  couponCode: string;
  onCouponChange: (value: string) => void;
  /** Asks the server for the discount; the purchase validates the coupon again. */
  onApplyCoupon: (code: string) => Promise<CouponPreviewState>;
  /** Ações finais (alerta de erro e botão de envio), sempre visíveis. */
  children?: ReactNode | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const couponId = useId();
  const couponHintId = useId();
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplying, startApplying] = useTransition();
  const typedCode = couponCode.trim();
  // A discount only counts for the code it was calculated for; editing the code drops it.
  const discountInCents = appliedCoupon?.code === typedCode ? appliedCoupon.discountInCents : null;
  const totalInCents = cartSummary.itemsSubtotalInCents + shippingTotalInCents - (discountInCents ?? 0);

  const applyCoupon = () => {
    if (typedCode === "") return;

    startApplying(async () => {
      const result = await onApplyCoupon(typedCode);
      if (result.discountInCents == null) {
        setAppliedCoupon(null);
        setCouponError(result.error ?? "Não foi possível aplicar o cupom.");
        return;
      }

      setCouponError(null);
      setAppliedCoupon({ code: typedCode, discountInCents: result.discountInCents });
    });
  };
  const itemLabel = `${cartSummary.itemCount} ${cartSummary.itemCount === 1 ? "item" : "itens"}`;

  return (
    <Card
      size="section"
      render={<aside aria-labelledby="checkout-summary-title" />}
      className="h-fit min-w-0 lg:sticky lg:top-24"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="checkout-summary-title" className="section-title">
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
              <li key={item.id} className="flex items-start gap-3">
                <CartItemThumbnail url={item.thumbnailUrl} sizes="48px" className="size-12" />
                <span className="min-w-0 flex-1">
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
          <div className="flex gap-2">
            <Input
              id={couponId}
              name="couponCode"
              value={couponCode}
              autoComplete="off"
              maxLength={40}
              aria-describedby={couponHintId}
              aria-invalid={couponError != null || undefined}
              onChange={(event) => onCouponChange(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                // Enter applies the coupon instead of submitting the whole order.
                if (event.key !== "Enter") return;
                event.preventDefault();
                applyCoupon();
              }}
              placeholder="Ex.: TRILHA10"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              pending={isApplying}
              pendingLabel="Aplicando…"
              disabled={typedCode === ""}
              onClick={applyCoupon}
            >
              Aplicar
            </Button>
          </div>
          <CouponHint id={couponHintId} error={couponError} applied={discountInCents != null} />
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
        {discountInCents == null ? null : (
          <div className="text-success-foreground flex items-center justify-between gap-3">
            <dt>Desconto do cupom</dt>
            <dd className="whitespace-nowrap tabular-nums">− {formatMoneyInCents(discountInCents)}</dd>
          </div>
        )}
        <div className="border-border flex items-center justify-between gap-3 border-t pt-2 text-base font-semibold">
          <dt>{hasQuotes ? "Total estimado" : "Total sem frete"}</dt>
          <dd className="tabular-nums">{formatMoneyInCents(totalInCents)}</dd>
        </div>
      </dl>

      {children}
    </Card>
  );
}

function CouponHint({ id, error, applied }: { id: string; error: string | null; applied: boolean }) {
  if (error != null)
    return (
      <p id={id} role="alert" className="text-destructive text-xs">
        {error}
      </p>
    );
  if (applied)
    return (
      <p id={id} className="text-success-foreground text-xs">
        Cupom aplicado. Ele é conferido de novo ao finalizar o pedido.
      </p>
    );

  return (
    <p id={id} className="text-muted-foreground text-xs">
      Toque em Aplicar para ver o desconto no total.
    </p>
  );
}
