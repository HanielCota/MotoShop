"use client";

import { useState } from "react";

import { DesignSelect } from "@/components/ui/design-select";
import { formatMoneyInCents } from "@/lib/utils";
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
    <section
      aria-labelledby="product-shipping-title"
      className="mt-5 rounded-xl border border-[#e4dfd5] bg-[#faf9f6] p-4"
    >
      <h2 id="product-shipping-title" className="text-sm font-semibold text-[#1b1a18]">
        Calcule a entrega
      </h2>
      <p className="mt-1 text-xs text-slate-600">
        Informe seu CEP para consultar as opções disponíveis. O prazo final aparece no checkout.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="text-xs font-medium text-slate-700">
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
        <label className="text-xs font-medium text-slate-700">
          CEP
          <input
            value={postalCode}
            onChange={(event) => setPostalCode(event.currentTarget.value)}
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
          disabled={pending || !variantId || postalCode.replace(/\D/g, "").length !== 8}
          className="bg-foreground text-background min-h-10 rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Calculando…" : "Calcular"}
        </button>
      </div>
      {message ? (
        <p role="status" className="mt-3 text-sm text-amber-800">
          {message}
        </p>
      ) : null}
      {quotes?.map((seller) => (
        <ul key={seller.sellerId} className="mt-3 divide-y rounded-lg border bg-white px-3">
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
                  <span className="ml-2 font-normal text-slate-600">
                    · {quote.estimatedDeliveryDays} dia(s) útil(eis)
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
