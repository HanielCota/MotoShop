import { z } from "zod";

import { isValidBrazilianPhone, isValidTaxId, onlyDigits } from "../domain/tax-id";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Compartilhado entre o formulário e a server action: o servidor sempre revalida. */
export const customerNameSchema = z.object({
  name: z
    .string({ error: "Informe seu nome." })
    .trim()
    .min(2, "Informe seu nome com pelo menos 2 letras.")
    .max(120, "Use no máximo 120 caracteres."),
});

export type CustomerNameInput = z.infer<typeof customerNameSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe sua senha atual.").max(PASSWORD_MAX_LENGTH),
    newPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `A nova senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`)
      .max(PASSWORD_MAX_LENGTH, `Use no máximo ${PASSWORD_MAX_LENGTH} caracteres.`),
    confirmation: z.string().min(1, "Repita a nova senha."),
  })
  .refine((values) => values.newPassword === values.confirmation, {
    path: ["confirmation"],
    message: "As senhas não coincidem.",
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    path: ["newPassword"],
    message: "A nova senha precisa ser diferente da atual.",
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Empty input clears the field; otherwise only the digits are kept and validated. */
const optionalDigits = (validate: (digits: string) => boolean, message: string, maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, message)
    .transform((value) => onlyDigits(value))
    .refine((digits) => digits === "" || validate(digits), message)
    .transform((digits) => (digits === "" ? null : digits));

/** CPF/CNPJ and phone are optional; the checkout reuses them only as prefill. */
export const customerContactSchema = z.object({
  taxId: optionalDigits(isValidTaxId, "Informe um CPF ou CNPJ válido.", 20),
  phone: optionalDigits(isValidBrazilianPhone, "Informe um telefone com DDD, ex.: (11) 98765-4321.", 20),
});

export type CustomerContactFormInput = z.input<typeof customerContactSchema>;
export type CustomerContactInput = z.output<typeof customerContactSchema>;
