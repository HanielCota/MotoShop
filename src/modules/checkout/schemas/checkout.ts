import { z } from "zod";
import { isBrazilianStateCode } from "@/modules/customers/domain/brazilian-address";
import { isValidBrazilianPhone, onlyDigits } from "@/modules/customers/domain/tax-id";

import { isValidCpf } from "../domain/cpf";

/** What the checkout sends to preview a coupon: the per-customer limit counts the e-mail and the CPF. */
export const couponPreviewSchema = z.object({
  couponCode: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
    z.string().min(1, "Digite o código do cupom.").max(40),
  ),
  customerEmail: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
    z.email("Preencha o seu e-mail para aplicar o cupom."),
  ),
  // An incomplete CPF is ignored here; the purchase still validates it.
  customerTaxId: z.preprocess(
    (value) => (typeof value === "string" ? value.replace(/\D/g, "") : undefined),
    z.string().max(20).optional(),
  ),
});

export const checkoutSchema = z
  .object({
    customerName: z.string().trim().min(2, "Informe seu nome.").max(120),
    // Normalized so per-customer coupon limits and order lookups cannot be bypassed by casing.
    customerEmail: z.preprocess(
      (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
      z.email("Informe um e-mail válido."),
    ),
    // Stored as digits, like the customer profile; the field only shows the (00) 00000-0000 mask.
    customerPhone: z
      .string()
      .max(30)
      .transform(onlyDigits)
      .refine(isValidBrazilianPhone, "Informe um telefone válido."),
    customerTaxId: z
      .string()
      .trim()
      .min(1, "Informe seu CPF para o pagamento.")
      .max(20)
      .transform((value) => value.replace(/\D/g, ""))
      .refine(isValidCpf, "Informe um CPF válido."),
    couponCode: z.preprocess(
      (value) => (typeof value === "string" && value.trim() ? value.trim().toUpperCase() : undefined),
      z.string().max(40).optional(),
    ),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{8}$/, "Informe um CEP com 8 números."),
    // Same limits as saved addresses (CustomerAddress), so an address snapshot is never unbounded.
    street: z.string().trim().min(2, "Informe a rua.").max(160, "Use no máximo 160 caracteres na rua."),
    number: z.string().trim().min(1, "Informe o número.").max(20, "Use no máximo 20 caracteres no número."),
    complement: z.string().trim().max(80).optional(),
    neighborhood: z.string().trim().min(2, "Informe o bairro.").max(100, "Use no máximo 100 caracteres no bairro."),
    city: z.string().trim().min(2, "Informe a cidade.").max(100, "Use no máximo 100 caracteres na cidade."),
    state: z.string().trim().toUpperCase().refine(isBrazilianStateCode, "Informe a UF."),
    paymentMethodId: z.enum(["pix", "visa", "master", "amex", "elo", "hipercard", "diners", "cabal"]),
    paymentToken: z
      .string()
      .regex(/^[a-f0-9]{32}$/i, "Token do cartão inválido.")
      .optional(),
    issuerId: z
      .string()
      .regex(/^\d{1,20}$/, "Emissor inválido.")
      .optional(),
    checkoutIdempotencyKey: z.uuid(),
    shippingSelections: z.string().min(2),
  })
  .superRefine((data, context) => {
    if (data.paymentMethodId !== "pix" && !data.paymentToken) {
      context.addIssue({ code: "custom", path: ["paymentToken"], message: "Preencha os dados protegidos do cartão." });
    }
    if (data.paymentMethodId === "pix" && (data.paymentToken || data.issuerId)) {
      context.addIssue({
        code: "custom",
        path: ["paymentMethodId"],
        message: "Dados de cartão não são aceitos no Pix.",
      });
    }
  });

export const shippingSelectionsSchema = z.record(z.string().cuid(), z.string().min(1));

export type CheckoutInput = z.infer<typeof checkoutSchema>;
