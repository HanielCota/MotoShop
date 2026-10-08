import "server-only";

import { env } from "@/config/env";
import { db } from "@/lib/database";
import { logger } from "@/lib/logger";
import { quoteOwnShipping } from "@/modules/shipping/domain/own-shipping";
import { getPackageMeasurements } from "@/modules/shipping/domain/package-measurements";
import { melhorEnvioProvider } from "@/lib/shipping/melhor-envio-provider";
import { getSellerMelhorEnvioAccessToken } from "@/modules/shipping/infrastructure/melhor-envio-oauth";
import { ApplicationError } from "@/shared/errors/application-error";
import { consumeRateLimit } from "@/shared/rate-limit/consume-rate-limit";
import type { ShippingQuote, ShippingQuoteInput } from "@/shared/shipping/shipping-provider";

import { getActiveCart } from "@/modules/cart/queries/cart";
import { purchasableVariantWhere } from "@/modules/products/application/purchasable-variant";
import { getCurrentPriceInCents } from "@/modules/products/domain/pricing";

export type CheckoutShippingQuote = Pick<
  ShippingQuote,
  "provider" | "serviceCode" | "carrier" | "service" | "priceInCents" | "estimatedDeliveryDays"
>;
export type SellerShippingQuotes = { sellerId: string; storeName: string; quotes: CheckoutShippingQuote[] };

// Interactive (pre-checkout) quotes spend the seller's own Melhor Envio quota,
// so they share a per-seller budget. Checkout submission is already limited
// per buyer and must not be blocked by browsing traffic.
const SELLER_QUOTE_BUDGET = { windowSeconds: 60, max: 120 } as const;

type QuoteOptions = { enforceSellerBudget?: boolean };

async function quoteIntegratedShipping(
  sellerId: string,
  input: ShippingQuoteInput,
  accessToken: string,
  options: QuoteOptions,
): Promise<ShippingQuote[]> {
  if (options.enforceSellerBudget) {
    const budget = await consumeRateLimit({ key: `shipping-quote:seller:${sellerId}`, ...SELLER_QUOTE_BUDGET });
    if (!budget.allowed) {
      logger.warn({ event: "shipping.seller_quote_budget_exceeded", sellerId });
      throw new ApplicationError({
        code: "CONFLICT",
        statusCode: 429,
        message: "O cálculo de frete desta loja está temporariamente indisponível. Tente novamente em instantes.",
      });
    }
  }
  return melhorEnvioProvider.quote(input, accessToken);
}

export async function quoteShippingForActiveCart(postalCode: string): Promise<SellerShippingQuotes[]> {
  const cart = await getActiveCart();
  return quoteShippingForCart(cart, postalCode, { enforceSellerBudget: true });
}

export async function quoteShippingForVariant(variantId: string, postalCode: string): Promise<SellerShippingQuotes[]> {
  const variant = await db.productVariant.findFirst({
    where: purchasableVariantWhere(variantId, { requireStock: true }),
    include: { inventory: true, product: { include: { store: true } } },
  });
  if (!variant?.product)
    throw new ApplicationError({ code: "NOT_FOUND", message: "Esta opção não está disponível para entrega." });

  const { product } = variant;
  const sellerId = product.sellerId;
  const fromPostalCode = product.store?.originPostalCode ?? env.MELHOR_ENVIO_ORIGIN_POSTAL_CODE;
  const methods = await db.sellerShippingMethod.findMany({ where: { sellerId, active: true } });
  const ownQuotes = quoteOwnShipping(methods, postalCode);
  const measurements = getPackageMeasurements(variant, product);
  const shippingIntegration = fromPostalCode
    ? await db.sellerShippingIntegration.findUnique({ where: { sellerId }, select: { id: true } })
    : null;
  if (shippingIntegration && !measurements && ownQuotes.length === 0) {
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message: "A loja ainda precisa informar o peso e as dimensões para calcular o frete integrado.",
    });
  }

  const accessToken =
    shippingIntegration && fromPostalCode && measurements ? await getSellerMelhorEnvioAccessToken(sellerId) : null;
  const providerQuotes =
    accessToken && fromPostalCode && measurements
      ? await quoteIntegratedShipping(
          sellerId,
          {
            fromPostalCode,
            toPostalCode: postalCode,
            products: [
              {
                id: variant.sku,
                ...measurements,
                insuranceValueInCents: getCurrentPriceInCents(variant),
                quantity: 1,
              },
            ],
          },
          accessToken,
          { enforceSellerBudget: true },
        ).catch((error: unknown) => {
          if (ownQuotes.length === 0) throw error;
          logger.warn({ event: "shipping.integrated_quote_unavailable", sellerId });
          return [];
        })
      : [];

  const quotes: CheckoutShippingQuote[] = [
    ...ownQuotes,
    ...providerQuotes.map((quote) => ({
      provider: quote.provider,
      serviceCode: quote.serviceCode,
      carrier: quote.carrier,
      service: quote.service,
      priceInCents: quote.priceInCents,
      ...(quote.estimatedDeliveryDays !== undefined ? { estimatedDeliveryDays: quote.estimatedDeliveryDays } : {}),
    })),
  ];
  if (quotes.length === 0)
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Esta loja não encontrou uma opção de entrega para este CEP.",
    });

  return [{ sellerId, storeName: product.store?.name ?? "Loja parceira", quotes }];
}

export async function quoteShippingForCart(
  cart: Awaited<ReturnType<typeof getActiveCart>>,
  postalCode: string,
  options: QuoteOptions = {},
): Promise<SellerShippingQuotes[]> {
  if (!cart || cart.items.length === 0) {
    throw new ApplicationError({ code: "NOT_FOUND", message: "Adicione um produto antes de calcular o frete." });
  }

  const groups = Map.groupBy(cart.items, (item) => item.variant.product.sellerId);
  const quotes = await Promise.all(
    Array.from(groups.entries()).map(async ([sellerId, items]) => {
      const firstItem = items[0];
      const store = firstItem?.variant.product.store;
      const fromPostalCode = store?.originPostalCode ?? env.MELHOR_ENVIO_ORIGIN_POSTAL_CODE;
      const methods = await db.sellerShippingMethod.findMany({ where: { sellerId, active: true } });
      const ownQuotes = quoteOwnShipping(methods, postalCode);
      const measuredProducts = items.map((item) => {
        const measurements = getPackageMeasurements(item.variant, item.variant.product);
        return measurements
          ? {
              id: item.variant.sku,
              ...measurements,
              insuranceValueInCents: getCurrentPriceInCents(item.variant) * item.quantity,
              quantity: item.quantity,
            }
          : null;
      });
      const products = measuredProducts.filter((product) => product !== null);
      const completeMeasurements = products.length === items.length;
      const shippingIntegration = fromPostalCode
        ? await db.sellerShippingIntegration.findUnique({ where: { sellerId }, select: { id: true } })
        : null;
      if (shippingIntegration && !completeMeasurements && ownQuotes.length === 0) {
        throw new ApplicationError({
          code: "CONFIGURATION_ERROR",
          message: "Uma loja precisa completar o peso e as medidas dos produtos antes de oferecer frete integrado.",
        });
      }

      const accessToken =
        shippingIntegration && fromPostalCode && completeMeasurements
          ? await getSellerMelhorEnvioAccessToken(sellerId)
          : null;
      const providerQuotes =
        accessToken && fromPostalCode && completeMeasurements
          ? await quoteIntegratedShipping(
              sellerId,
              { fromPostalCode, toPostalCode: postalCode, products },
              accessToken,
              options,
            ).catch((error: unknown) => {
              if (ownQuotes.length === 0) throw error;
              logger.warn({ event: "shipping.integrated_quote_unavailable", sellerId });
              return [];
            })
          : [];

      return {
        sellerId,
        storeName: store?.name ?? "Loja",
        quotes: [
          ...ownQuotes,
          ...providerQuotes.map((quote) => ({
            provider: quote.provider,
            serviceCode: quote.serviceCode,
            carrier: quote.carrier,
            service: quote.service,
            priceInCents: quote.priceInCents,
            ...(quote.estimatedDeliveryDays !== undefined
              ? { estimatedDeliveryDays: quote.estimatedDeliveryDays }
              : {}),
          })),
        ],
      } satisfies SellerShippingQuotes;
    }),
  );

  if (quotes.some((seller) => seller.quotes.length === 0)) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Uma ou mais lojas ainda não oferecem entrega para este CEP. Confira o endereço ou ajuste o carrinho.",
    });
  }
  return quotes;
}
