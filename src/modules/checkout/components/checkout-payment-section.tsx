"use client";

import type { RefObject } from "react";

import { DesignRadio, DesignRadioGroup } from "@/components/ui/design-radio";
import { SecureCardFields, type SecureCardHandle } from "@/modules/payments/components/secure-card-fields";

import type { CheckoutPaymentType } from "./use-checkout-submit";

export function CheckoutPaymentSection({
  paymentAvailable,
  cardPublicKey,
  paymentType,
  onPaymentTypeChange,
  disabled,
  cardRef,
}: {
  paymentAvailable: boolean;
  cardPublicKey?: string | undefined;
  paymentType: CheckoutPaymentType;
  onPaymentTypeChange: (paymentType: CheckoutPaymentType) => void;
  disabled: boolean;
  cardRef: RefObject<SecureCardHandle | null>;
}) {
  return (
    <section aria-labelledby="checkout-payment-title" className="bg-card rounded-xl border p-4 sm:p-6">
      <h2 id="checkout-payment-title" className="section-title">
        Pagamento
      </h2>
      {paymentAvailable ? (
        <>
          {/* O grupo de rádio já é nomeado ("Forma de pagamento"); não repetir com <legend>. */}
          <div className="mt-3 space-y-2">
            <DesignRadioGroup
              label="Forma de pagamento"
              name="paymentType"
              value={paymentType}
              onValueChange={(nextValue) => onPaymentTypeChange(nextValue === "card" ? "card" : "pix")}
              disabled={disabled}
              className="space-y-2"
            >
              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm">
                <DesignRadio value="pix" />
                Pix
              </label>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm">
                <DesignRadio value="card" disabled={!cardPublicKey} />
                Cartão de crédito · 1 parcela
              </label>
            </DesignRadioGroup>
            {!cardPublicKey ? (
              <p className="text-muted-foreground text-xs">Cartão ainda indisponível. Você pode continuar com Pix.</p>
            ) : null}
          </div>
          {paymentType === "card" && cardPublicKey ? (
            <SecureCardFields publicKey={cardPublicKey} ref={cardRef} />
          ) : null}
        </>
      ) : (
        // The page already explains why at the top; repeating it here only adds noise.
        <p className="text-muted-foreground mt-2 text-sm">
          Pix e cartão aparecem aqui quando os pagamentos forem liberados.
        </p>
      )}
    </section>
  );
}
