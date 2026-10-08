"use client";

import { Truck } from "lucide-react";

import { DesignRadio, DesignRadioGroup } from "@/components/ui/design-radio";
import { FormMessage } from "@/components/ui/form-message";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoneyInCents } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { SellerShippingQuotes } from "../application/shipping-quotes";

export function CheckoutShippingOptions({
  quotes,
  selections,
  onSelect,
  isQuoting,
  error,
}: {
  quotes: SellerShippingQuotes[];
  selections: Record<string, string>;
  onSelect: (sellerId: string, serviceCode: string) => void;
  isQuoting: boolean;
  error?: string | undefined;
}) {
  return (
    <section
      aria-labelledby="checkout-shipping-title"
      aria-busy={isQuoting || undefined}
      className="bg-card rounded-xl border p-4 sm:p-6"
    >
      <h2 id="checkout-shipping-title" className="text-lg font-semibold">
        Frete por loja
      </h2>
      <p aria-live="polite" className="sr-only">
        {isQuoting ? "Calculando opções de frete…" : ""}
      </p>
      {isQuoting ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ) : error ? (
        <FormMessage className="mt-3" error={error ?? null} />
      ) : quotes.length === 0 ? (
        <p className="text-muted-foreground mt-2 flex items-center gap-2 text-sm">
          <Truck aria-hidden="true" className="size-4 shrink-0" />
          Informe o CEP para ver as opções de entrega.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {quotes.map((seller) => (
            <fieldset key={seller.sellerId} className="space-y-2">
              <legend className="font-medium">{seller.storeName}</legend>
              <DesignRadioGroup
                label={`Frete de ${seller.storeName}`}
                name={`shipping-${seller.sellerId}`}
                value={selections[seller.sellerId] ?? ""}
                onValueChange={(serviceCode) => onSelect(seller.sellerId, serviceCode)}
                className="space-y-2"
              >
                {seller.quotes.map((quote) => {
                  const selected = selections[seller.sellerId] === quote.serviceCode;
                  return (
                    <label
                      key={quote.serviceCode}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 text-sm transition-colors",
                        selected ? "border-primary bg-moto-brand-surface" : "hover:bg-muted/50",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <DesignRadio value={quote.serviceCode} />
                        <span>
                          {quote.carrier} · {quote.service}
                          {quote.estimatedDeliveryDays !== undefined ? (
                            <span className="text-muted-foreground block text-xs">
                              {quote.estimatedDeliveryDays === 1
                                ? "1 dia útil"
                                : `${quote.estimatedDeliveryDays} dias úteis`}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span className="font-medium tabular-nums">{formatMoneyInCents(quote.priceInCents)}</span>
                    </label>
                  );
                })}
              </DesignRadioGroup>
            </fieldset>
          ))}
        </div>
      )}
    </section>
  );
}
