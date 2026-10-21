import type { CustomerAddress } from "@/modules/customers/queries/customer-addresses";
import { formatPhone, isValidBrazilianPhone, onlyDigits } from "@/modules/customers/domain/tax-id";
import {
  formatCep,
  formatCpf,
  isBrazilianStateCode,
  normalizeCep,
  normalizeCpf,
} from "@/modules/customers/domain/brazilian-address";

import { isValidCpf } from "../domain/cpf";

export type CheckoutFormState = {
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

export type CheckoutField = keyof CheckoutFormState;
export type CheckoutFieldErrors = Partial<Record<CheckoutField, string>>;
export type CheckoutFieldChange = (field: CheckoutField, value: string) => void;

export type CheckoutSummaryItem = {
  id: string;
  name: string;
  variant: string;
  quantity: number;
  lineTotalInCents: number;
};

export const initialCheckoutForm: CheckoutFormState = {
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

/** Ordem visual dos campos: usada para focar o primeiro campo inválido. */
export const checkoutFieldOrder: CheckoutField[] = [
  "customerName",
  "customerEmail",
  "customerPhone",
  "customerTaxId",
  "postalCode",
  "street",
  "number",
  "complement",
  "neighborhood",
  "city",
  "state",
];

export function checkoutFieldId(field: CheckoutField) {
  return `checkout-${field}`;
}

export function applySavedAddress(form: CheckoutFormState, address: CustomerAddress): CheckoutFormState {
  return {
    ...form,
    customerName: address.recipient,
    postalCode: formatCep(address.postalCode),
    street: address.street,
    number: address.number,
    complement: address.complement ?? "",
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
  };
}

/** Signed-in customer data used only as checkout prefill: account e-mail and the /account/profile contact (digits only). */
export type CheckoutCustomerDefaults = { email?: string | null; taxId: string | null; phone: string | null };

/** Prefills e-mail, phone and CPF; a CNPJ is left out because the payment requires the payer's CPF. */
export function applyCustomerDefaults(form: CheckoutFormState, defaults: CheckoutCustomerDefaults): CheckoutFormState {
  const cpf = defaults.taxId?.length === 11 ? defaults.taxId : null;
  return {
    ...form,
    ...(defaults.email ? { customerEmail: defaults.email } : {}),
    ...(defaults.phone ? { customerPhone: formatPhone(defaults.phone) } : {}),
    ...(cpf ? { customerTaxId: formatCpf(cpf) } : {}),
  };
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Espelha as regras de `checkoutSchema` para dar feedback por campo antes do envio. */
export function validateCheckoutForm(form: CheckoutFormState): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};
  if (form.customerName.trim().length < 2) errors.customerName = "Informe seu nome.";
  if (!emailPattern.test(form.customerEmail.trim())) errors.customerEmail = "Informe um e-mail válido.";
  if (!isValidBrazilianPhone(onlyDigits(form.customerPhone))) errors.customerPhone = "Informe um telefone válido.";
  const cpf = normalizeCpf(form.customerTaxId);
  if (!cpf) errors.customerTaxId = "Informe seu CPF para o pagamento.";
  if (cpf && !isValidCpf(cpf)) errors.customerTaxId = "Informe um CPF válido.";
  if (normalizeCep(form.postalCode).length !== 8) errors.postalCode = "Informe um CEP com 8 números.";
  if (form.street.trim().length < 2) errors.street = "Informe a rua.";
  if (!form.number.trim()) errors.number = "Informe o número.";
  if (form.neighborhood.trim().length < 2) errors.neighborhood = "Informe o bairro.";
  if (form.city.trim().length < 2) errors.city = "Informe a cidade.";
  if (!isBrazilianStateCode(form.state.trim().toUpperCase())) errors.state = "Informe a UF.";
  return errors;
}

/** Converte os valores mascarados para o formato aceito pela server action. */
export function toCheckoutFormEntries(form: CheckoutFormState): [CheckoutField, string][] {
  return (Object.entries(form) as [CheckoutField, string][]).map(([field, value]) => {
    if (field === "postalCode") return [field, normalizeCep(value)];
    if (field === "customerTaxId") return [field, normalizeCpf(value)];
    if (field === "state") return [field, value.trim().toUpperCase()];
    return [field, value];
  });
}

const serverMessageFields: Record<string, CheckoutField> = {
  "Informe seu nome.": "customerName",
  "Informe um e-mail válido.": "customerEmail",
  "Informe um telefone válido.": "customerPhone",
  "Informe seu CPF para o pagamento.": "customerTaxId",
  "Informe um CPF válido.": "customerTaxId",
  "Informe um CEP com 8 números.": "postalCode",
  "Informe a rua.": "street",
  "Informe o número.": "number",
  "Informe o bairro.": "neighborhood",
  "Informe a cidade.": "city",
  "Informe a UF.": "state",
};

/** Associa uma mensagem de validação do servidor ao campo correspondente, quando reconhecida. */
export function fieldForServerMessage(message: string): CheckoutField | undefined {
  return serverMessageFields[message];
}
