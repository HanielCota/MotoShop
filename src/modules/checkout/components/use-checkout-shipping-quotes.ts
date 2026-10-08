"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";

import { normalizeCep } from "@/modules/customers/domain/brazilian-address";

import { quoteShippingAction } from "../actions/shipping-actions";
import type { SellerShippingQuotes } from "../application/shipping-quotes";

const offlineMessage = "Não foi possível calcular o frete. Verifique sua conexão e tente novamente.";

/**
 * Cotação de frete do carrinho com proteção contra corrida: uma resposta só é aplicada
 * se ainda corresponder ao último CEP solicitado (`version`).
 */
export function useCheckoutShippingQuotes() {
  const [quotes, setQuotes] = useState<SellerShippingQuotes[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [isQuoting, startQuote] = useTransition();
  const version = useRef(0);
  const quotedCep = useRef<string | null>(null);

  const reset = useCallback(() => {
    version.current += 1;
    quotedCep.current = null;
    setQuotes([]);
    setSelections({});
    setError(undefined);
  }, []);

  const requestQuote = useCallback((rawPostalCode: string, { force = true }: { force?: boolean } = {}) => {
    const postalCode = normalizeCep(rawPostalCode);
    if (!force && postalCode === quotedCep.current) return;
    const current = ++version.current;
    quotedCep.current = postalCode;
    setError(undefined);
    startQuote(async () => {
      try {
        const result = await quoteShippingAction(postalCode);
        if (current !== version.current) return;
        if (result.error) {
          setError(result.error);
          setQuotes([]);
          setSelections({});
          return;
        }
        const nextQuotes = result.quotes ?? [];
        setQuotes(nextQuotes);
        setSelections(
          Object.fromEntries(nextQuotes.map((seller) => [seller.sellerId, seller.quotes[0]?.serviceCode ?? ""])),
        );
        if (nextQuotes.length === 0) setError("Nenhuma opção de entrega disponível para este CEP.");
      } catch {
        if (current !== version.current) return;
        setError(offlineMessage);
        setQuotes([]);
        setSelections({});
      }
    });
  }, []);

  const select = useCallback((sellerId: string, serviceCode: string) => {
    setSelections((current) => ({ ...current, [sellerId]: serviceCode }));
  }, []);

  const shippingTotalInCents = useMemo(
    () =>
      quotes.reduce((total, seller) => {
        const quote = seller.quotes.find((item) => item.serviceCode === selections[seller.sellerId]);
        return total + (quote?.priceInCents ?? 0);
      }, 0),
    [quotes, selections],
  );

  return {
    quotes,
    selections,
    error,
    isQuoting,
    hasQuotes: quotes.length > 0,
    shippingTotalInCents,
    requestQuote,
    reset,
    select,
  };
}
