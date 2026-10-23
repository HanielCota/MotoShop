"use client";

import { CheckoutFormField } from "./checkout-field";
import type { CheckoutField, CheckoutFieldChange, CheckoutFieldErrors, CheckoutFormState } from "./checkout-form-model";

export function CheckoutCustomerFields({
  form,
  errors,
  onChange,
  onBlur,
}: {
  form: CheckoutFormState;
  errors: CheckoutFieldErrors;
  onChange: CheckoutFieldChange;
  onBlur: (field: CheckoutField) => void;
}) {
  return (
    <section aria-labelledby="checkout-customer-title" className="bg-card rounded-xl border p-4 sm:p-6">
      <h2 id="checkout-customer-title" className="section-title">
        Seus dados
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <CheckoutFormField
          label="Nome completo"
          name="customerName"
          value={form.customerName}
          onChange={onChange}
          error={errors.customerName}
          autoComplete="name"
          required
        />
        <CheckoutFormField
          label="E-mail"
          name="customerEmail"
          onBlur={onBlur}
          type="email"
          inputMode="email"
          value={form.customerEmail}
          onChange={onChange}
          error={errors.customerEmail}
          autoComplete="email"
          required
        />
        <CheckoutFormField
          label="Telefone"
          name="customerPhone"
          onBlur={onBlur}
          type="tel"
          value={form.customerPhone}
          onChange={onChange}
          error={errors.customerPhone}
          autoComplete="tel"
          placeholder="(11) 90000-0000"
          maxLength={15}
          required
        />
        <CheckoutFormField
          label="Seu CPF"
          name="customerTaxId"
          onBlur={onBlur}
          value={form.customerTaxId}
          onChange={onChange}
          error={errors.customerTaxId}
          hint="Usado na nota fiscal e no pagamento."
          placeholder="000.000.000-00"
          maxLength={14}
          inputMode="numeric"
          autoComplete="off"
          required
        />
      </div>
    </section>
  );
}
