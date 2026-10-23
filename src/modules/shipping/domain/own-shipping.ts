import { z } from "zod";

import { parsePriceInputToCents } from "@/modules/products/domain/price-input";
import type { FieldProblem } from "@/shared/forms/field-error-focus";
import { firstIssue } from "@/shared/forms/first-issue-message";

const postalCode = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .pipe(z.string().regex(/^\d{8}$/, "Informe o CEP com 8 números."));
const deliveryDaysMessage = "Informe o prazo em dias úteis, de 1 a 365.";
export const ownShippingMethodSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Use pelo menos 3 caracteres no nome da entrega.")
      .max(80, "Use no máximo 80 caracteres no nome da entrega."),
    postalCodeStart: postalCode,
    postalCodeEnd: postalCode,
    priceInCents: z
      .number({ error: "Informe o valor em reais, ex.: 15,00." })
      .int("Informe o valor em reais, ex.: 15,00.")
      .min(0, "O valor não pode ser negativo.")
      .max(100_000_000, "O valor informado é maior que o permitido."),
    estimatedDeliveryDays: z.coerce
      .number({ error: deliveryDaysMessage })
      .int(deliveryDaysMessage)
      .min(1, deliveryDaysMessage)
      .max(365, deliveryDaysMessage),
  })
  .refine((value) => value.postalCodeStart <= value.postalCodeEnd, {
    message: "O CEP inicial deve ser menor ou igual ao CEP final.",
    path: ["postalCodeEnd"],
  });

export type OwnShippingMethodInput = z.infer<typeof ownShippingMethodSchema>;

export const OWN_SHIPPING_FORM_ERROR = "Confira o nome, os CEPs, o valor e o prazo de entrega.";

/** Lê o formulário de modalidade como a action recebe (valor em reais vira centavos). */
export function readOwnShippingMethodForm(form: FormData) {
  return { ...Object.fromEntries(form), priceInCents: parsePriceInputToCents(form.get("price") ?? undefined) };
}

/** Mesma regra no servidor e no navegador (BUG-011). */
export function validateOwnShippingMethodForm(form: FormData): FieldProblem | null {
  return firstIssue(ownShippingMethodSchema, readOwnShippingMethodForm(form), OWN_SHIPPING_FORM_ERROR, {
    priceInCents: "price",
  });
}
export function quoteOwnShipping(
  methods: Array<OwnShippingMethodInput & { id: string; active: boolean }>,
  destination: string,
) {
  const code = postalCode.parse(destination);
  return methods
    .filter((method) => method.active && method.postalCodeStart <= code && method.postalCodeEnd >= code)
    .map((method) => ({
      provider: "OWN",
      serviceCode: `own:${method.id}`,
      carrier: "Entrega da loja",
      service: method.name,
      priceInCents: method.priceInCents,
      estimatedDeliveryDays: method.estimatedDeliveryDays,
    }));
}

export function canAdvanceOwnShipment(orderStatus: string, shipmentStatus: string, next: "SHIPPED" | "DELIVERED") {
  if (next === "SHIPPED")
    return ["PAID", "PROCESSING"].includes(orderStatus) && ["PENDING", "READY_TO_SHIP"].includes(shipmentStatus);
  return orderStatus === "SHIPPED" && ["SHIPPED", "IN_TRANSIT"].includes(shipmentStatus);
}
