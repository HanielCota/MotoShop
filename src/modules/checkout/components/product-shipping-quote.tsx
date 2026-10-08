"use client";

import { useState } from "react";

import { DesignSelect } from "@/components/ui/design-select";
import { FormMessage } from "@/components/ui/form-message";
import { formatMoneyInCents, formatCount } from "@/lib/format";
import { formatCep, isCompleteCep } from "@/modules/customers/domain/brazilian-address";
import { quoteProductShippingAction } from "../actions/shipping-actions";

type Option = { id: string; title: string; available: boolean };

export function ProductShippingQuote({ options }: { options: Option[] }) {
  const availableOptions = options.filter((option) => option.available);
  const [variantId, setVariantId] = useState(availableOptions[0]?.id ?? "");
  const [postalCode, setPostalCode] = useState("");
  const [quotes, setQuotes] = useState<Awaited<ReturnType<typeof quoteProductShippingAction>>["quotes"]>(undefined);
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  async function calculate() {
    setMessage(undefined);
    setQuotes(undefined);
    setPending(true);
    try {
      const result = await quoteProductShippingAction({ variantId, postalCode });
      if (result.error) setMessage(result.error);
      else setQuotes(result.quotes);
    } catch {
      setMessage("Não foi possível calcular o frete agora. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  if (!availableOptions.length) return null;

  return (
    <section aria-labelledby="product-shipping-title" className="bg-surface-sunken mt-5 rounded-xl border p-4">
      <h2 id="product-shipping-title" className="text-foreground text-sm font-semibold">
        Calcule a entrega
      </h2>
      <p className="text-muted-foreground mt-1 text-xs">
        Informe seu CEP para consultar as opções disponíveis. O prazo final aparece no checkout.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="text-foreground text-xs font-medium">
          Opção do produto
          <DesignSelect
            aria-label="Opção para cálculo de frete"
            value={variantId}
            onValueChange={(value) => {
              if (typeof value !== "string") return;
              setVariantId(value);
              setQuotes(undefined);
              setMessage(undefined);
            }}
            className="mt-1 min-h-10 w-full"
          >
            {availableOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </DesignSelect>
        </label>
        <label className="text-foreground text-xs font-medium">
          CEP
          <input
            value={postalCode}
            onChange={(event) => setPostalCode(formatCep(event.currentTarget.value))}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={9}
            placeholder="00000-000"
            aria-label="CEP para cálculo de frete"
            className="border-input bg-background focus-visible:ring-moto-brand mt-1 min-h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2"
          />
        </label>
        <button
          type="button"
          onClick={() => void calculate()}
          disabled={pending || !variantId || !isCompleteCep(postalCode)}
          className="bg-foreground text-background min-h-11 rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Calculando…" : "Calcular"}
        </button>
      </div>
      <FormMessage className="mt-3" error={message ?? null} />
      {quotes?.map((seller) => (
        <ul key={seller.sellerId} className="bg-card mt-3 divide-y rounded-lg border px-3">
          {seller.quotes.map((quote) => (
            <li
              key={`${quote.provider}-${quote.serviceCode}`}
              className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
            >
              <span>
                {quote.carrier} · {quote.service}
              </span>
              <span className="font-semibold">
                {formatMoneyInCents(quote.priceInCents)}
                {quote.estimatedDeliveryDays !== undefined ? (
                  <span className="text-muted-foreground ml-2 font-normal">
                    · {formatCount(quote.estimatedDeliveryDays, "dia útil", "dias úteis")}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ))}
    </section>
  );
}
