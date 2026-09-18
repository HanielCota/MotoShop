import { z } from "zod";

export const checkoutSchema = z.object({
  customerName: z.string().trim().min(2, "Informe seu nome.").max(120),
  customerEmail: z.email("Informe um e-mail válido."),
  customerPhone: z.string().trim().min(10, "Informe um telefone válido.").max(30),
  customerTaxId: z.string().trim().max(20).optional(),
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
  paymentMethodId: z.literal("pix"),
  checkoutIdempotencyKey: z.uuid(),
  shippingSelections: z.string().min(2),
});

export const shippingSelectionsSchema = z.record(z.string().cuid(), z.string().min(1));

export type CheckoutInput = z.infer<typeof checkoutSchema>;
