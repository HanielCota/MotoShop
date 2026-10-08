import { z } from "zod";
import { isValidCpf } from "../domain/cpf";

export const checkoutSchema = z
  .object({
    customerName: z.string().trim().min(2, "Informe seu nome.").max(120),
    // Normalized so per-customer coupon limits and order lookups cannot be bypassed by casing.
    customerEmail: z.preprocess(
      (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
      z.email("Informe um e-mail válido."),
    ),
    customerPhone: z.string().trim().min(10, "Informe um telefone válido.").max(30),
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
    street: z.string().trim().min(2, "Informe a rua."),
    number: z.string().trim().min(1, "Informe o número."),
    complement: z.string().trim().max(80).optional(),
    neighborhood: z.string().trim().min(2, "Informe o bairro."),
    city: z.string().trim().min(2, "Informe a cidade."),
    state: z.string().trim().length(2, "Informe a UF.").toUpperCase(),
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
