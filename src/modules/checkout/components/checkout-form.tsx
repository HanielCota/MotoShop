"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import type { Route } from "next";

import { Button } from "@/components/ui/button";
import { formatMoneyInCents } from "@/lib/utils";
import type { CustomerAddress } from "@/modules/customers/queries/customer-addresses";

import { createCheckoutAction, type CheckoutActionState } from "../actions/checkout-actions";
import { quoteShippingAction } from "../actions/shipping-actions";
import type { SellerShippingQuotes } from "../application/shipping-quotes";

const inputClassName =
  "border-input bg-background focus:ring-ring/40 h-10 w-full rounded-md border px-3 text-sm outline-none focus:ring-3";

type CheckoutFormState = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerTaxId: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  couponCode: string;
};

const initialForm: CheckoutFormState = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  customerTaxId: "",
  postalCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  couponCode: "",
};

export function CheckoutForm({
  savedAddresses = [],
  cartSummary,
}: {
  savedAddresses?: CustomerAddress[];
  cartSummary: { itemCount: number; itemsSubtotalInCents: number };
}) {
  const router = useRouter();
  const [form, setForm] = useState(() => {
    const defaultAddress = savedAddresses.find((address) => address.isDefault);
    return defaultAddress ? applySavedAddress(initialForm, defaultAddress) : initialForm;
  });
  const [selectedAddressId, setSelectedAddressId] = useState(
    () => savedAddresses.find((address) => address.isDefault)?.id ?? "",
  );
  const [quotes, setQuotes] = useState<SellerShippingQuotes[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const [isQuoting, startQuote] = useTransition();
  const [isSubmitting, startSubmit] = useTransition();

  function updateField(field: keyof CheckoutFormState, value: string) {
    setSelectedAddressId("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectSavedAddress(addressId: string) {
    setSelectedAddressId(addressId);
    const address = savedAddresses.find((item) => item.id === addressId);
    if (address) setForm((current) => applySavedAddress(current, address));
  }

  function handleQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    startQuote(async () => {
      const result = await quoteShippingAction(form.postalCode);
      if (result.error) {
        setMessage(result.error);
        setQuotes([]);
        return;
      }
      setQuotes(result.quotes ?? []);
      setSelections(
        Object.fromEntries(
          (result.quotes ?? []).map((seller) => [seller.sellerId, seller.quotes[0]?.serviceCode ?? ""]),
        ),
      );
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    startSubmit(async () => {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => formData.append(key, value));
      formData.append("paymentMethodId", "pix");
      formData.append("checkoutIdempotencyKey", crypto.randomUUID());
      formData.append("shippingSelections", JSON.stringify(selections));
      const result: CheckoutActionState = await createCheckoutAction({}, formData);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      if (result.orderNumber) {
        const params = new URLSearchParams({ orderNumber: result.orderNumber });
        if (result.guestAccessToken) params.set("accessToken", result.guestAccessToken);
        router.push(`/checkout/success?${params.toString()}` as Route);
      }
    });
  }

  const selectedShippingAmountInCents = quotes.reduce((total, seller) => {
    const selectedServiceCode = selections[seller.sellerId];
    const quote = seller.quotes.find((item) => item.serviceCode === selectedServiceCode);
    return total + (quote?.priceInCents ?? 0);
  }, 0);
  const estimatedTotalInCents = cartSummary.itemsSubtotalInCents + selectedShippingAmountInCents;

  return (
    <form className="grid gap-6 lg:grid-cols-[1fr_20rem]" onSubmit={handleSubmit}>
      <div className="space-y-6">
        <section className="rounded-xl border p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Seus dados</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Nome completo"
              name="customerName"
              value={form.customerName}
              onChange={updateField}
              required
            />
            <Field
              label="E-mail"
              name="customerEmail"
              type="email"
              value={form.customerEmail}
              onChange={updateField}
              required
            />
            <Field label="Telefone" name="customerPhone" value={form.customerPhone} onChange={updateField} required />
            <Field label="CPF (se necessário)" name="customerTaxId" value={form.customerTaxId} onChange={updateField} />
          </div>
        </section>

        <section className="rounded-xl border p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Endereço de entrega</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {savedAddresses.length > 0 ? (
              <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
                Usar endereço salvo
                <select
                  className={inputClassName}
                  value={selectedAddressId}
                  onChange={(event) => selectSavedAddress(event.target.value)}
                >
                  <option value="">Preencher um novo endereço</option>
                  {savedAddresses.map((address) => (
                    <option key={address.id} value={address.id}>
                      {address.label} · {address.street}, {address.number} · {address.city}/{address.state}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="flex items-end gap-2 sm:col-span-2">
              <Field label="CEP" name="postalCode" value={form.postalCode} onChange={updateField} required />
              <Button
                type="button"
                variant="outline"
                disabled={isQuoting}
                onClick={() => handleQuote({ preventDefault() {} } as FormEvent<HTMLFormElement>)}
              >
                {isQuoting ? "Calculando…" : "Calcular frete"}
              </Button>
            </div>
            <Field label="Rua" name="street" value={form.street} onChange={updateField} required />
            <Field label="Número" name="number" value={form.number} onChange={updateField} required />
            <Field label="Complemento" name="complement" value={form.complement} onChange={updateField} />
            <Field label="Bairro" name="neighborhood" value={form.neighborhood} onChange={updateField} required />
            <Field label="Cidade" name="city" value={form.city} onChange={updateField} required />
            <Field label="UF" name="state" maxLength={2} value={form.state} onChange={updateField} required />
          </div>
        </section>

        <section className="rounded-xl border p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Frete por loja</h2>
          {quotes.length === 0 ? (
            <p className="text-muted-foreground mt-2 text-sm">Informe o CEP e calcule o frete para continuar.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {quotes.map((seller) => (
                <fieldset key={seller.sellerId} className="space-y-2">
                  <legend className="font-medium">{seller.storeName}</legend>
                  {seller.quotes.map((quote) => (
                    <label
                      key={quote.serviceCode}
                      className="has-checked:border-primary flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`shipping-${seller.sellerId}`}
                          checked={selections[seller.sellerId] === quote.serviceCode}
                          onChange={() =>
                            setSelections((current) => ({ ...current, [seller.sellerId]: quote.serviceCode }))
                          }
                        />
                        <span>
                          {quote.carrier} · {quote.service}
                        </span>
                      </span>
                      <span className="font-medium">{formatMoneyInCents(quote.priceInCents)}</span>
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="h-fit rounded-xl border p-4 sm:p-6">
        <h2 className="font-semibold">Pagamento</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Pagamento via Pix com confirmação server-side do Mercado Pago.
        </p>
        <label className="mt-4 flex flex-col gap-2 text-sm font-medium">
          Cupom de desconto
          <input
            name="couponCode"
            value={form.couponCode}
            onChange={(event) => updateField("couponCode", event.target.value.toUpperCase())}
            placeholder="Ex.: TRILHA10"
            className={inputClassName}
          />
        </label>
        <div className="bg-muted/40 mt-5 space-y-2 rounded-lg p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span>Itens ({cartSummary.itemCount})</span>
            <span>{formatMoneyInCents(cartSummary.itemsSubtotalInCents)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Frete</span>
            <span>{quotes.length > 0 ? formatMoneyInCents(selectedShippingAmountInCents) : "Calcule acima"}</span>
          </div>
          <div className="border-border flex items-center justify-between gap-3 border-t pt-2 font-semibold">
            <span>Total estimado</span>
            <span>{formatMoneyInCents(estimatedTotalInCents)}</span>
          </div>
          {form.couponCode ? <p className="text-muted-foreground text-xs">O cupom será validado novamente no servidor.</p> : null}
        </div>
        {message ? (
          <p className="text-destructive mt-4 text-sm" role="alert">
            {message}
          </p>
        ) : null}
        <Button className="mt-6 w-full" type="submit" disabled={isSubmitting || quotes.length === 0}>
          {isSubmitting ? "Criando pedido…" : "Finalizar pedido"}
        </Button>
      </aside>
    </form>
  );
}

function applySavedAddress(form: CheckoutFormState, address: CustomerAddress): CheckoutFormState {
  return {
    ...form,
    customerName: address.recipient,
    postalCode: address.postalCode,
    street: address.street,
    number: address.number,
    complement: address.complement ?? "",
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
  };
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required,
  maxLength,
}: {
  label: string;
  name: keyof CheckoutFormState;
  value: string;
  onChange: (name: keyof CheckoutFormState, value: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      {label}
      <input
        className={inputClassName}
        name={name}
        type={type}
        value={value}
        required={required}
        maxLength={maxLength}
        onChange={(event) => onChange(name, event.target.value)}
      />
    </label>
  );
}
