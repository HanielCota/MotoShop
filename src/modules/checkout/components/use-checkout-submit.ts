"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useTransition, type RefObject } from "react";

import type { SecureCardHandle } from "@/modules/payments/components/secure-card-fields";

import { createCheckoutAction, type CheckoutActionState } from "../actions/checkout-actions";
import { toCheckoutFormEntries, type CheckoutFormState } from "./checkout-form-model";
import { isTerminalCheckoutFailure } from "./checkout-submit-result";

export type CheckoutPaymentType = "pix" | "card";

const terminalFallbackMessage = "O pagamento não foi aprovado. Revise os dados ou escolha outra forma de pagamento.";
const unknownFailureMessage = "Não foi possível concluir. Consulte seu pedido antes de tentar novamente.";

/**
 * Envio do checkout: tokeniza o cartão (quando houver), mantém a mesma chave de idempotência
 * entre reenvios de uma tentativa e a descarta somente após uma falha definitiva de pagamento.
 */
export function useCheckoutSubmit({
  cardRef,
  onFailure,
}: {
  cardRef: RefObject<SecureCardHandle | null>;
  onFailure: (message: string) => void;
}) {
  const router = useRouter();
  const [isSubmitting, startSubmit] = useTransition();
  const idempotencyKey = useRef<string | null>(null);
  const inFlight = useRef(false);

  const submit = useCallback(
    (input: { form: CheckoutFormState; paymentType: CheckoutPaymentType; selections: Record<string, string> }) => {
      if (inFlight.current) return;
      inFlight.current = true;
      startSubmit(async () => {
        try {
          const formData = new FormData();
          toCheckoutFormEntries(input.form).forEach(([key, value]) => formData.append(key, value));
          if (input.paymentType === "card") {
            if (!cardRef.current) throw new Error("Aguarde o carregamento dos campos do cartão.");
            const tokenized = await cardRef.current.tokenize();
            Object.entries(tokenized).forEach(([key, value]) => formData.append(key, value));
          } else formData.append("paymentMethodId", "pix");
          idempotencyKey.current ??= crypto.randomUUID();
          formData.append("checkoutIdempotencyKey", idempotencyKey.current);
          formData.append("shippingSelections", JSON.stringify(input.selections));

          const result: CheckoutActionState = await createCheckoutAction({}, formData);
          if (isTerminalCheckoutFailure(result)) {
            // Nova tentativa precisa de nova chave; a anterior aponta para um pedido cancelado.
            idempotencyKey.current = null;
            onFailure(result.error ?? terminalFallbackMessage);
            return;
          }
          if (result.error) {
            onFailure(result.error);
            return;
          }
          if (result.orderNumber) {
            const query = result.guestAccessToken ? `?accessToken=${encodeURIComponent(result.guestAccessToken)}` : "";
            router.push(`/orders/${encodeURIComponent(result.orderNumber)}${query}` as Route);
          }
        } catch (error) {
          onFailure(error instanceof Error && error.message ? error.message : unknownFailureMessage);
        } finally {
          inFlight.current = false;
        }
      });
    },
    [cardRef, onFailure, router],
  );

  return { submit, isSubmitting };
}
