"use client";
import { Input } from "@/components/ui/input";

import { DesignRadio, DesignRadioGroup } from "@/components/ui/design-radio";

import { DesignSelect } from "@/components/ui/design-select";

import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState, useTransition } from "react";
import type { Route } from "next";

import { Button } from "@/components/ui/button";
import { formatMoneyInCents } from "@/lib/utils";
import type { CustomerAddress } from "@/modules/customers/queries/customer-addresses";
import { SecureCardFields, type SecureCardHandle } from "@/modules/payments/components/secure-card-fields";

import { createCheckoutAction, type CheckoutActionState } from "../actions/checkout-actions";
import { quoteShippingAction } from "../actions/shipping-actions";
import type { SellerShippingQuotes } from "../application/shipping-quotes";


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
  cardPublicKey,
  paymentAvailable = true,
}: {
  savedAddresses?: CustomerAddress[];
  cartSummary: { itemCount: number; itemsSubtotalInCents: number };
  cardPublicKey?: string;
  paymentAvailable?: boolean;
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
  const checkoutKey = useRef<string | null>(null);
  const card = useRef<SecureCardHandle>(null);
  const submitting = useRef(false);
  const quoteVersion = useRef(0);
  const [paymentType, setPaymentType] = useState<"pix" | "card">("pix");

  function updateField(field: keyof CheckoutFormState, value: string) {
    if (field === "postalCode") {
      quoteVersion.current += 1;
      setQuotes([]);
      setSelections({});
    }
    setSelectedAddressId("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectSavedAddress(addressId: string) {
    quoteVersion.current += 1;
    setQuotes([]);
    setSelections({});
    setSelectedAddressId(addressId);
    const address = savedAddresses.find((item) => item.id === addressId);
    if (address) setForm((current) => applySavedAddress(current, address));
  }

  function handleQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    const version = ++quoteVersion.current;
    startQuote(async () => {
      try {
        const result = await quoteShippingAction(form.postalCode);
        if (version !== quoteVersion.current) return;
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
      } catch {
        if (version !== quoteVersion.current) return;
        setMessage("Não foi possível calcular o frete. Verifique sua conexão e tente novamente.");
        setQuotes([]);
        setSelections({});
      }
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setMessage(undefined);
    startSubmit(async () => {
      try {
        const formData = new FormData();
        Object.entries(form).forEach(([key, value]) => formData.append(key, value));
        if (paymentType === "card") {
          if (!card.current) throw new Error("Aguarde o carregamento dos campos do cartão.");
          const tokenized = await card.current.tokenize();
          Object.entries(tokenized).forEach(([key, value]) => formData.append(key, value));
        } else formData.append("paymentMethodId", "pix");
        checkoutKey.current ??= crypto.randomUUID();
        formData.append("checkoutIdempotencyKey", checkoutKey.current);
        formData.append("shippingSelections", JSON.stringify(selections));
        const result: CheckoutActionState = await createCheckoutAction({}, formData);
        if (result.error) {
          setMessage(result.error);
          return;
        }
        if (result.orderNumber) {
          router.push(
            `/orders/${encodeURIComponent(result.orderNumber)}${result.guestAccessToken ? `?accessToken=${encodeURIComponent(result.guestAccessToken)}` : ""}` as Route,
          );
        }
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível concluir. Consulte seu pedido antes de tentar novamente.",
        );
      } finally {
        submitting.current = false;
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
            <Field
              label="CPF do comprador"
              name="customerTaxId"
              value={form.customerTaxId}
              onChange={updateField}
              maxLength={14}
              inputMode="numeric"
              required
            />
          </div>
        </section>

        <section className="rounded-xl border p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Endereço de entrega</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {savedAddresses.length > 0 ? (
              <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
                Usar endereço salvo
                <DesignSelect
                  aria-label="Usar endereço salvo"
                  value={selectedAddressId}
                  onValueChange={(value) => selectSavedAddress(String(value))}
                >
                  <option value="">Preencher um novo endereço</option>
                  {savedAddresses.map((address) => (
                    <option key={address.id} value={address.id}>
                      {address.label} · {address.street}, {address.number} · {address.city}/{address.state}
                    </option>
                  ))}
                </DesignSelect>
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
                  <DesignRadioGroup
                    label={`Frete de ${seller.storeName}`}
                    name={`shipping-${seller.sellerId}`}
                    value={selections[seller.sellerId] ?? ""}
                    onValueChange={(serviceCode) =>
                      setSelections((current) => ({ ...current, [seller.sellerId]: serviceCode }))
                    }
                    className="space-y-2"
                  >
                    {seller.quotes.map((quote) => (
                      <label
                        key={quote.serviceCode}
                        className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 text-sm ${selections[seller.sellerId] === quote.serviceCode ? "border-primary" : ""}`}
                      >
                        <span className="flex items-center gap-2">
                          <DesignRadio value={quote.serviceCode} />
                          <span>
                            {quote.carrier} · {quote.service}
                          </span>
                        </span>
                        <span className="font-medium">{formatMoneyInCents(quote.priceInCents)}</span>
                      </label>
                    ))}
                  </DesignRadioGroup>
                </fieldset>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="h-fit rounded-xl border p-4 sm:p-6">
        <h2 className="font-semibold">Pagamento</h2>
        {paymentAvailable ? (
          <>
            <fieldset className="mt-3 space-y-2" disabled={isSubmitting}>
              <legend className="sr-only">Forma de pagamento</legend>
              <DesignRadioGroup
                label="Forma de pagamento"
                name="paymentType"
                value={paymentType}
                onValueChange={(nextValue) => setPaymentType(nextValue === "card" ? "card" : "pix")}
                disabled={isSubmitting}
                className="space-y-2"
              >
                <label className="flex items-center gap-2 text-sm">
                  <DesignRadio value="pix" />
                  Pix
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <DesignRadio value="card" disabled={!cardPublicKey} />
                  Cartão de crédito · 1 parcela
                </label>
              </DesignRadioGroup>
              {!cardPublicKey ? (
                <p className="text-muted-foreground text-xs">Cartão ainda indisponível. Você pode continuar com Pix.</p>
              ) : null}
            </fieldset>
            {paymentType === "card" && cardPublicKey ? (
              <SecureCardFields publicKey={cardPublicKey} ref={card} />
            ) : null}
          </>
        ) : (
          <p role="status" className="bg-muted/40 mt-3 rounded-lg p-3 text-sm leading-6">
            O pagamento pelo marketplace está temporariamente indisponível. O lojista precisa conectar a conta do
            Mercado Pago antes de aceitar pedidos. Nenhuma cobrança será criada.
          </p>
        )}
        <label className="mt-4 flex flex-col gap-2 text-sm font-medium">
          Cupom de desconto
          <Input
            name="couponCode"
            value={form.couponCode}
            onChange={(event) => updateField("couponCode", event.target.value.toUpperCase())}
            placeholder="Ex.: TRILHA10"
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
          {form.couponCode ? (
            <p className="text-muted-foreground text-xs">O cupom será validado novamente no servidor.</p>
          ) : null}
        </div>
        {message ? (
          <p className="text-destructive mt-4 text-sm" role="alert">
            {message}
          </p>
        ) : null}
        <Button
          className="mt-6 w-full"
          type="submit"
          disabled={isSubmitting || quotes.length === 0 || !paymentAvailable}
        >
          {isSubmitting ? "Criando pedido…" : paymentAvailable ? "Finalizar pedido" : "Pagamento indisponível"}
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
  inputMode,
}: {
  label: string;
  name: keyof CheckoutFormState;
  value: string;
  onChange: (name: keyof CheckoutFormState, value: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
  inputMode?: "numeric";
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      {label}
      <Input
        name={name}
        type={type}
        value={value}
        required={required}
        maxLength={maxLength}
        inputMode={inputMode}
        onChange={(event) => onChange(name, event.target.value)}
      />
    </label>
  );
}
