import { z } from "zod";

const postalCode = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .pipe(z.string().regex(/^\d{8}$/));
export const ownShippingMethodSchema = z
  .object({
    name: z.string().trim().min(3).max(80),
    postalCodeStart: postalCode,
    postalCodeEnd: postalCode,
    priceInCents: z.number().int().min(0).max(100_000_000),
    estimatedDeliveryDays: z.coerce.number().int().min(1).max(365),
  })
  .refine((value) => value.postalCodeStart <= value.postalCodeEnd, {
    message: "O CEP inicial deve ser menor ou igual ao CEP final.",
    path: ["postalCodeEnd"],
  });

export type OwnShippingMethodInput = z.infer<typeof ownShippingMethodSchema>;
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
