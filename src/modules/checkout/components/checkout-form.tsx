"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { formatCep, formatCpf, isCompleteCep } from "@/modules/customers/domain/brazilian-address";
import { formatPhone } from "@/modules/customers/domain/tax-id";
import { useCepAutofill } from "@/modules/customers/components/use-cep-autofill";
import type { CustomerAddress } from "@/modules/customers/queries/customer-addresses";
import { notifyCartUpdated } from "@/modules/cart/components/cart-events";
import type { SecureCardHandle } from "@/modules/payments/components/secure-card-fields";
import { highlightControl, highlightInvalidField } from "@/shared/forms/field-error-focus";

import { previewCheckoutCouponAction } from "../actions/checkout-actions";
import { CheckoutAddressFields } from "./checkout-address-fields";
import { CheckoutCustomerFields } from "./checkout-customer-fields";
import {
  applyCustomerDefaults,
  applySavedAddress,
  checkoutFieldId,
  checkoutFieldOrder,
  fieldForServerMessage,
  initialCheckoutForm,
  validateCheckoutFieldOnBlur,
  validateCheckoutForm,
  type CheckoutCustomerDefaults,
  type CheckoutField,
  type CheckoutFieldErrors,
  type CheckoutSummaryItem,
} from "./checkout-form-model";
import { CheckoutOrderSummary } from "./checkout-order-summary";
import { CheckoutPaymentSection } from "./checkout-payment-section";
import type { SimulatedPurchase } from "../domain/simulated-purchase";
import { CheckoutShippingOptions } from "./checkout-shipping-options";
import { SimulatedPurchaseConfirmation } from "./simulated-purchase-confirmation";
import { useCheckoutShippingQuotes } from "./use-checkout-shipping-quotes";
import { useCheckoutSubmit, type CheckoutPaymentType } from "./use-checkout-submit";

const maskedFields: Partial<Record<CheckoutField, (value: string) => string>> = {
  postalCode: formatCep,
  customerTaxId: formatCpf,
  customerPhone: formatPhone,
  state: (value) => value.toUpperCase(),
  couponCode: (value) => value.toUpperCase(),
};

export function CheckoutForm({
  savedAddresses = [],
  cartSummary,
  items,
  cardPublicKey,
  paymentAvailable = true,
  pixOnly = false,
  header,
  customerDefaults,
}: {
  savedAddresses?: CustomerAddress[] | undefined;
  /** Phone and CPF saved in the signed-in customer's profile. */
  customerDefaults?: CheckoutCustomerDefaults | undefined;
  cartSummary: { itemCount: number; itemsSubtotalInCents: number };
  items?: CheckoutSummaryItem[] | undefined;
  cardPublicKey?: string | undefined;
  paymentAvailable?: boolean | undefined;
  /** Test products: Pix only, no card fields (they would already call Mercado Pago). */
  pixOnly?: boolean | undefined;
  /** Page heading, replaced by the confirmation after a simulated purchase. */
  header?: ReactNode | undefined;
}) {
  const [form, setForm] = useState(() => {
    const defaultAddress = savedAddresses.find((address) => address.isDefault);
    const prefilled = customerDefaults
      ? applyCustomerDefaults(initialCheckoutForm, customerDefaults)
      : initialCheckoutForm;
    return defaultAddress ? applySavedAddress(prefilled, defaultAddress) : prefilled;
  });
  const [selectedAddressId, setSelectedAddressId] = useState(
    () => savedAddresses.find((address) => address.isDefault)?.id ?? "",
  );
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [paymentType, setPaymentType] = useState<CheckoutPaymentType>("pix");
  const errorRef = useRef<HTMLDivElement>(null);
  const card = useRef<SecureCardHandle>(null);
  const hasItems = cartSummary.itemCount > 0;

  const shipping = useCheckoutShippingQuotes();
  const cep = useCepAutofill(setForm);

  // Renders the alert right away. A field error flashes and focuses that field; any other error
  // moves focus to the alert, for screen readers and keyboard users.
  const handleFailure = useCallback((message: string) => {
    const field = fieldForServerMessage(message);
    flushSync(() => {
      if (field) setFieldErrors((current) => ({ ...current, [field]: message }));
      setFormError(message);
    });
    const control = field ? document.getElementById(checkoutFieldId(field)) : null;
    if (control) {
      highlightControl(control);
      return;
    }
    errorRef.current?.focus();
  }, []);
  const [simulatedPurchase, setSimulatedPurchase] = useState<SimulatedPurchase>();
  const handleSimulatedPurchase = useCallback((purchase: SimulatedPurchase) => {
    setSimulatedPurchase(purchase);
    // The cart was emptied on the server: the header badge reloads it.
    notifyCartUpdated();
    window.scrollTo({ top: 0 });
  }, []);
  const { submit, isSubmitting } = useCheckoutSubmit({
    cardRef: card,
    onFailure: handleFailure,
    onSimulatedPurchase: handleSimulatedPurchase,
  });

  // Endereço padrão já preenchido: calcula o frete sem exigir clique.
  const { requestQuote } = shipping;
  const initialPostalCode = useRef(form.postalCode);
  useEffect(() => {
    if (hasItems && isCompleteCep(initialPostalCode.current)) requestQuote(initialPostalCode.current, { force: false });
  }, [hasItems, requestQuote]);

  // The error shows as soon as the person leaves the field; editing it clears it (updateField).
  function checkFieldOnBlur(field: CheckoutField) {
    const message = validateCheckoutFieldOnBlur(form, field);
    if (message == null) return;

    setFieldErrors((current) => ({ ...current, [field]: message }));
  }

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
    if (firstInvalid) {
      flushSync(() => {
        setFieldErrors(errors);
        setFormError("Revise os campos destacados para continuar.");
      });
      // By name: a CEP the lookup did not find is also `aria-invalid`, but it does not block the order.
      highlightInvalidField(event.currentTarget, firstInvalid);
      return;
    }
    setFieldErrors(errors);
    if (!shipping.hasQuotes) {
      handleFailure("Calcule o frete e escolha uma opção de entrega.");
      return;
    }
    setFormError(undefined);
    submit({ form, paymentType, selections: shipping.selections });
  }

  const invalidFields = checkoutFieldOrder.filter((field) => fieldErrors[field]);
  // A CEP the automatic lookup does not know shows in the field, in red, but does not block the order:
  // a new street may exist before the lookup service lists it.
  const cepNotFound = cep.status === "not-found" ? cep.hint : undefined;
  const addressErrors =
    cepNotFound && !fieldErrors.postalCode ? { ...fieldErrors, postalCode: cepNotFound } : fieldErrors;

  if (simulatedPurchase) return <SimulatedPurchaseConfirmation purchase={simulatedPurchase} />;

  return (
    <>
      {header}
      <form
        noValidate
        className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"
        onSubmit={handleSubmit}
      >
        <div className="min-w-0 space-y-6">
          <CheckoutCustomerFields form={form} errors={fieldErrors} onChange={updateField} onBlur={checkFieldOnBlur} />
          <CheckoutAddressFields
            form={form}
            errors={addressErrors}
            onBlur={checkFieldOnBlur}
            onChange={updateField}
            savedAddresses={savedAddresses}
            selectedAddressId={selectedAddressId}
            onSelectSavedAddress={selectSavedAddress}
            cepHint={cepNotFound ? undefined : cep.hint}
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
            pixOnly={pixOnly}
            cardPublicKey={pixOnly ? undefined : cardPublicKey}
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
          couponCustomerKey={`${form.customerEmail.trim().toLowerCase()}|${form.customerTaxId.replace(/\D/g, "")}`}
          onApplyCoupon={(code) =>
            previewCheckoutCouponAction({
              couponCode: code,
              customerEmail: form.customerEmail,
              customerTaxId: form.customerTaxId,
            })
          }
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
    </>
  );
}
