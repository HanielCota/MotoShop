"use client";

import { Button } from "@/components/ui/button";
import { DesignSelect } from "@/components/ui/design-select";
import type { CustomerAddress } from "@/modules/customers/queries/customer-addresses";

import { CheckoutFormField } from "./checkout-field";
import type { CheckoutField, CheckoutFieldChange, CheckoutFieldErrors, CheckoutFormState } from "./checkout-form-model";

export function CheckoutAddressFields({
  form,
  errors,
  onChange,
  onBlur,
  savedAddresses,
  selectedAddressId,
  onSelectSavedAddress,
  cepHint,
  onQuote,
  isQuoting,
}: {
  form: CheckoutFormState;
  errors: CheckoutFieldErrors;
  onChange: CheckoutFieldChange;
  onBlur: (field: CheckoutField) => void;
  savedAddresses: CustomerAddress[];
  selectedAddressId: string;
  onSelectSavedAddress: (addressId: string) => void;
  cepHint?: string | undefined;
  onQuote: () => void;
  isQuoting: boolean;
}) {
  return (
    <section aria-labelledby="checkout-address-title" className="bg-card rounded-xl border p-4 sm:p-6">
      <h2 id="checkout-address-title" className="section-title">
        Endereço de entrega
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* min-w-0: a grid item otherwise grows to the selected address text and scrolls the page sideways. */}
        {savedAddresses.length > 0 ? (
          <label className="flex min-w-0 flex-col gap-2 text-sm font-medium sm:col-span-2">
            Usar endereço salvo
            <DesignSelect
              aria-label="Usar endereço salvo"
              value={selectedAddressId}
              onValueChange={(value) => onSelectSavedAddress(String(value))}
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
        <div className="flex min-w-0 flex-wrap items-start gap-2 sm:col-span-2">
          <CheckoutFormField
            className="w-full max-w-48 flex-none"
            label="CEP"
            name="postalCode"
            onBlur={onBlur}
            value={form.postalCode}
            onChange={onChange}
            error={errors.postalCode}
            hint={cepHint}
            placeholder="00000-000"
            maxLength={9}
            inputMode="numeric"
            autoComplete="postal-code"
            required
          />
          <Button
            pending={isQuoting}
            pendingLabel="Calculando…"
            type="button"
            variant="outline"
            className="mt-7"
            onClick={onQuote}
          >
            Calcular frete
          </Button>
        </div>
        <CheckoutFormField
          className="sm:col-span-2"
          label="Rua"
          name="street"
          value={form.street}
          onChange={onChange}
          error={errors.street}
          autoComplete="address-line1"
          required
        />
        <CheckoutFormField
          label="Número"
          name="number"
          value={form.number}
          onChange={onChange}
          error={errors.number}
          inputMode="numeric"
          maxLength={20}
          required
        />
        <CheckoutFormField
          label="Complemento (opcional)"
          name="complement"
          value={form.complement}
          onChange={onChange}
          error={errors.complement}
          autoComplete="address-line2"
          maxLength={80}
        />
        <CheckoutFormField
          label="Bairro"
          name="neighborhood"
          value={form.neighborhood}
          onChange={onChange}
          error={errors.neighborhood}
          autoComplete="address-level3"
          required
        />
        <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-4">
          <CheckoutFormField
            label="Cidade"
            name="city"
            value={form.city}
            onChange={onChange}
            error={errors.city}
            autoComplete="address-level2"
            required
          />
          <CheckoutFormField
            label="UF"
            name="state"
            maxLength={2}
            value={form.state}
            onChange={onChange}
            error={errors.state}
            autoComplete="address-level1"
            required
          />
        </div>
      </div>
    </section>
  );
}
