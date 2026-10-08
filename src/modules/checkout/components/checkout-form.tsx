"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { formatCep, formatCpf, isCompleteCep } from "@/modules/customers/domain/brazilian-address";
import { useCepAutofill } from "@/modules/customers/components/use-cep-autofill";
import type { CustomerAddress } from "@/modules/customers/queries/customer-addresses";
import type { SecureCardHandle } from "@/modules/payments/components/secure-card-fields";

import { CheckoutAddressFields } from "./checkout-address-fields";
import { CheckoutCustomerFields } from "./checkout-customer-fields";
import {
  applySavedAddress,
  checkoutFieldId,
  checkoutFieldOrder,
  fieldForServerMessage,
  initialCheckoutForm,
  validateCheckoutForm,
  type CheckoutField,
  type CheckoutFieldErrors,
  type CheckoutSummaryItem,
} from "./checkout-form-model";
import { CheckoutOrderSummary } from "./checkout-order-summary";
import { CheckoutPaymentSection } from "./checkout-payment-section";
import { CheckoutShippingOptions } from "./checkout-shipping-options";
import { useCheckoutShippingQuotes } from "./use-checkout-shipping-quotes";
import { useCheckoutSubmit, type CheckoutPaymentType } from "./use-checkout-submit";

const maskedFields: Partial<Record<CheckoutField, (value: string) => string>> = {
  postalCode: formatCep,
  customerTaxId: formatCpf,
  state: (value) => value.toUpperCase(),
  couponCode: (value) => value.toUpperCase(),
};

export function CheckoutForm({
  savedAddresses = [],
  cartSummary,
  items,
  cardPublicKey,
  paymentAvailable = true,
}: {
  savedAddresses?: CustomerAddress[] | undefined;
  cartSummary: { itemCount: number; itemsSubtotalInCents: number };
  items?: CheckoutSummaryItem[] | undefined;
  cardPublicKey?: string | undefined;
  paymentAvailable?: boolean | undefined;
}) {
  const [form, setForm] = useState(() => {
    const defaultAddress = savedAddresses.find((address) => address.isDefault);
    return defaultAddress ? applySavedAddress(initialCheckoutForm, defaultAddress) : initialCheckoutForm;
  });
  const [selectedAddressId, setSelectedAddressId] = useState(
    () => savedAddresses.find((address) => address.isDefault)?.id ?? "",
  );
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [failureCount, setFailureCount] = useState(0);
  const [paymentType, setPaymentType] = useState<CheckoutPaymentType>("pix");
  const errorRef = useRef<HTMLDivElement>(null);
  const card = useRef<SecureCardHandle>(null);
  const hasItems = cartSummary.itemCount > 0;

  const shipping = useCheckoutShippingQuotes();
  const cep = useCepAutofill(setForm);

  const handleFailure = useCallback((message: string) => {
    const field = fieldForServerMessage(message);
    if (field) setFieldErrors((current) => ({ ...current, [field]: message }));
    setFormError(message);
    setFailureCount((count) => count + 1);
  }, []);
  const { submit, isSubmitting } = useCheckoutSubmit({ cardRef: card, onFailure: handleFailure });

  // Move o foco para o alerta sempre que um envio falha, para leitores de tela e teclado.
  useEffect(() => {
    if (failureCount > 0) errorRef.current?.focus();
  }, [failureCount]);

  // Endereço padrão já preenchido: calcula o frete sem exigir clique.
  const { requestQuote } = shipping;
  const initialPostalCode = useRef(form.postalCode);
  useEffect(() => {
    if (hasItems && isCompleteCep(initialPostalCode.current)) requestQuote(initialPostalCode.current, { force: false });
  }, [hasItems, requestQuote]);

  function updateField(field: CheckoutField, rawValue: string) {
    const value = maskedFields[field]?.(rawValue) ?? rawValue;
    if (field !== "couponCode") setSelectedAddressId("");
    setFieldErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
    setForm((current) => ({ ...current, [field]: value }));

    if (field === "postalCode") {
      shipping.reset();
      cep.lookup(value);
      if (hasItems && isCompleteCep(value)) shipping.requestQuote(value);
    }
  }

  function selectSavedAddress(addressId: string) {
    setSelectedAddressId(addressId);
    const address = savedAddresses.find((item) => item.id === addressId);
    if (!address) return;
    shipping.reset();
    cep.reset();
    setFieldErrors({});
    setForm((current) => applySavedAddress(current, address));
    if (hasItems && isCompleteCep(address.postalCode)) shipping.requestQuote(address.postalCode);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    const errors = validateCheckoutForm(form);
    const firstInvalid = checkoutFieldOrder.find((field) => errors[field]);
    setFieldErrors(errors);
    if (firstInvalid) {
      setFormError("Revise os campos destacados para continuar.");
      setFailureCount((count) => count + 1);
      return;
    }
    if (!shipping.hasQuotes) {
      handleFailure("Calcule o frete e escolha uma opção de entrega.");
      return;
    }
    setFormError(undefined);
    submit({ form, paymentType, selections: shipping.selections });
  }

  const invalidFields = checkoutFieldOrder.filter((field) => fieldErrors[field]);

  return (
    <form
      noValidate
      className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"
      onSubmit={handleSubmit}
    >
      <div className="min-w-0 space-y-6">
        <CheckoutCustomerFields form={form} errors={fieldErrors} onChange={updateField} />
        <CheckoutAddressFields
          form={form}
          errors={fieldErrors}
          onChange={updateField}
          savedAddresses={savedAddresses}
          selectedAddressId={selectedAddressId}
          onSelectSavedAddress={selectSavedAddress}
          cepHint={cep.hint}
          isQuoting={shipping.isQuoting}
          onQuote={() => shipping.requestQuote(form.postalCode)}
        />
        <CheckoutShippingOptions
          quotes={shipping.quotes}
          selections={shipping.selections}
          onSelect={shipping.select}
          isQuoting={shipping.isQuoting}
          error={shipping.error}
        />
        <CheckoutPaymentSection
          paymentAvailable={paymentAvailable}
          cardPublicKey={cardPublicKey}
          paymentType={paymentType}
          onPaymentTypeChange={setPaymentType}
          disabled={isSubmitting}
          cardRef={card}
        />
      </div>

      <CheckoutOrderSummary
        cartSummary={cartSummary}
        items={items}
        shippingTotalInCents={shipping.shippingTotalInCents}
        hasQuotes={shipping.hasQuotes}
        isQuoting={shipping.isQuoting}
        couponCode={form.couponCode}
        onCouponChange={(value) => updateField("couponCode", value)}
      >
        {formError ? (
          <div ref={errorRef} tabIndex={-1} className="mt-4 outline-none">
            <FormMessage error={formError} />
            {invalidFields.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm">
                {invalidFields.map((field) => (
                  <li key={field}>
                    <a className="text-destructive underline underline-offset-4" href={`#${checkoutFieldId(field)}`}>
                      {fieldErrors[field]}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <Button
          className="mt-4 w-full"
          size="lg"
          type="submit"
          disabled={isSubmitting || !shipping.hasQuotes || !paymentAvailable}
        >
          {isSubmitting ? "Criando pedido…" : paymentAvailable ? "Finalizar pedido" : "Pagamento indisponível"}
        </Button>
        {paymentAvailable && !shipping.hasQuotes ? (
          <p className="text-muted-foreground mt-2 text-center text-xs">Calcule o frete para finalizar.</p>
        ) : null}
      </CheckoutOrderSummary>
    </form>
  );
}
