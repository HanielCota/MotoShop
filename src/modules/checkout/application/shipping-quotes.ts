import "server-only";

import { env } from "@/config/env";
import { melhorEnvioProvider } from "@/lib/shipping/melhor-envio-provider";
import { ApplicationError } from "@/shared/errors/application-error";
import type { ShippingQuote } from "@/shared/shipping/shipping-provider";

import { getActiveCart } from "@/modules/cart/queries/cart";
import { getCurrentPriceInCents } from "@/modules/products/domain/pricing";

export type CheckoutShippingQuote = Pick<
  ShippingQuote,
  "provider" | "serviceCode" | "carrier" | "service" | "priceInCents" | "estimatedDeliveryDays"
>;
export type SellerShippingQuotes = { sellerId: string; storeName: string; quotes: CheckoutShippingQuote[] };

export async function quoteShippingForActiveCart(postalCode: string): Promise<SellerShippingQuotes[]> {
  const cart = await getActiveCart();
  if (!cart || cart.items.length === 0) {
    throw new ApplicationError({ code: "NOT_FOUND", message: "Adicione um produto antes de calcular o frete." });
  }

  const groups = Map.groupBy(cart.items, (item) => item.variant.product.sellerId);
  const quotes = await Promise.all(
    Array.from(groups.entries()).map(async ([sellerId, items]) => {
      const firstItem = items[0];
      const store = firstItem?.variant.product.store;
      const fromPostalCode = store?.originPostalCode ?? env.MELHOR_ENVIO_ORIGIN_POSTAL_CODE;
      if (!fromPostalCode) {
        throw new ApplicationError({
          code: "CONFIGURATION_ERROR",
          message: `A loja ${store?.name ?? "do seller"} ainda não possui CEP de origem configurado.`,
          statusCode: 409,
        });
      }

      const providerQuotes = await melhorEnvioProvider.quote({
        fromPostalCode,
        toPostalCode: postalCode,
        products: items.map((item) => ({
          id: item.variant.sku,
          widthInCm: Math.max(
            1,
            (item.variant.widthInMillimeters ?? item.variant.product.widthInMillimeters ?? 100) / 10,
          ),
          heightInCm: Math.max(
            1,
            (item.variant.heightInMillimeters ?? item.variant.product.heightInMillimeters ?? 100) / 10,
          ),
          lengthInCm: Math.max(
            1,
            (item.variant.lengthInMillimeters ?? item.variant.product.lengthInMillimeters ?? 100) / 10,
          ),
          weightInKg: Math.max(0.1, (item.variant.weightInGrams ?? item.variant.product.weightInGrams ?? 500) / 1000),
          insuranceValueInCents: getCurrentPriceInCents(item.variant) * item.quantity,
          quantity: item.quantity,
        })),
      });

      return {
        sellerId,
        storeName: store?.name ?? "Loja",
        quotes: providerQuotes.map((quote) => ({
          provider: quote.provider,
          serviceCode: quote.serviceCode,
          carrier: quote.carrier,
          service: quote.service,
          priceInCents: quote.priceInCents,
          ...(quote.estimatedDeliveryDays !== undefined ? { estimatedDeliveryDays: quote.estimatedDeliveryDays } : {}),
        })),
      } satisfies SellerShippingQuotes;
    }),
  );

  if (quotes.some((seller) => seller.quotes.length === 0)) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Não encontramos uma opção de frete para todos os sellers.",
    });
  }
  return quotes;
}
