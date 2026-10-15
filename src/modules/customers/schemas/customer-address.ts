import { z } from "zod";

import { isBrazilianStateCode } from "../domain/brazilian-address";

/** Shared by the address form and the server action: the server always validates again. */
export const customerAddressSchema = z.object({
  label: z.string().trim().min(2, "Informe um nome para o endereço.").max(40, "Use no máximo 40 caracteres."),
  recipient: z.string().trim().min(2, "Informe o destinatário.").max(120, "Use no máximo 120 caracteres."),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "Informe um CEP com 8 números."),
  street: z.string().trim().min(2, "Informe a rua.").max(160, "Use no máximo 160 caracteres."),
  number: z.string().trim().min(1, "Informe o número.").max(20, "Use no máximo 20 caracteres."),
  complement: z.string().trim().max(80, "Use no máximo 80 caracteres.").optional(),
  neighborhood: z.string().trim().min(2, "Informe o bairro.").max(100, "Use no máximo 100 caracteres."),
  city: z.string().trim().min(2, "Informe a cidade.").max(100, "Use no máximo 100 caracteres."),
  state: z.string().trim().toUpperCase().refine(isBrazilianStateCode, "Informe uma UF válida, como SP ou RJ."),
  isDefault: z.boolean().default(false),
});

export type CustomerAddressField = keyof z.input<typeof customerAddressSchema>;
export type CustomerAddressFieldErrors = Partial<Record<CustomerAddressField, string>>;

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export function parseCustomerAddressForm(formData: FormData) {
  return customerAddressSchema.safeParse({
    label: textValue(formData, "label"),
    recipient: textValue(formData, "recipient"),
    postalCode: textValue(formData, "postalCode").replace(/\D/g, ""),
    street: textValue(formData, "street"),
    number: textValue(formData, "number"),
    complement: textValue(formData, "complement") || undefined,
    neighborhood: textValue(formData, "neighborhood"),
    city: textValue(formData, "city"),
    state: textValue(formData, "state"),
    isDefault: formData.get("isDefault") === "on",
  });
}

/** First message per field, in the order the schema reports them. */
export function customerAddressFieldErrors(error: z.ZodError): CustomerAddressFieldErrors {
  const errors: CustomerAddressFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || !(field in customerAddressSchema.shape)) continue;
    const key = field as CustomerAddressField;
    errors[key] ??= issue.message;
  }
  return errors;
}
