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
import type { ShippingProduct, ShippingQuote, ShippingQuoteInput } from "@/shared/shipping/shipping-provider";

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
  const variant = await findQuotableVariant(variantId);
  const { product } = variant;
  const sellerId = product.sellerId;
  const fromPostalCode = product.store?.originPostalCode ?? env.MELHOR_ENVIO_ORIGIN_POSTAL_CODE;
  const ownQuotes = await quoteSellerOwnShipping(sellerId, postalCode);
  const measurements = getPackageMeasurements(variant, product);
  const hasIntegration = await hasShippingIntegration(sellerId, fromPostalCode);
  if (hasIntegration && !measurements && ownQuotes.length === 0) {
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message: "A loja ainda precisa informar o peso e as dimensões para calcular o frete integrado.",
    });
  }

  const products = measurements
    ? [{ id: variant.sku, ...measurements, insuranceValueInCents: getCurrentPriceInCents(variant), quantity: 1 }]
    : null;
  const providerQuotes = await quoteProviderShipping({
    sellerId,
    hasIntegration,
    fromPostalCode,
    toPostalCode: postalCode,
    products,
    ownQuotes,
    options: { enforceSellerBudget: true },
  });

  const quotes: CheckoutShippingQuote[] = [...ownQuotes, ...providerQuotes.map(toCheckoutShippingQuote)];
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
    Array.from(groups.entries()).map(([sellerId, items]) => quoteSellerCartItems(sellerId, items, postalCode, options)),
  );

  if (quotes.some((seller) => seller.quotes.length === 0)) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Uma ou mais lojas ainda não oferecem entrega para este CEP. Confira o endereço ou ajuste o carrinho.",
    });
  }
  return quotes;
}

type ShippingCartItem = NonNullable<Awaited<ReturnType<typeof getActiveCart>>>["items"][number];

async function quoteSellerCartItems(
  sellerId: string,
  items: ShippingCartItem[],
  postalCode: string,
  options: QuoteOptions,
): Promise<SellerShippingQuotes> {
  const store = items[0]?.variant.product.store;
  const fromPostalCode = store?.originPostalCode ?? env.MELHOR_ENVIO_ORIGIN_POSTAL_CODE;
  const ownQuotes = await quoteSellerOwnShipping(sellerId, postalCode);
  const products = items
    .map(toMeasuredShippingProduct)
    .filter((product): product is ShippingProduct => product !== null);
  const completeMeasurements = products.length === items.length;
  const hasIntegration = await hasShippingIntegration(sellerId, fromPostalCode);
  if (hasIntegration && !completeMeasurements && ownQuotes.length === 0) {
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message: "Uma loja precisa completar o peso e as medidas dos produtos antes de oferecer frete integrado.",
    });
  }

  const providerQuotes = await quoteProviderShipping({
    sellerId,
    hasIntegration,
    fromPostalCode,
    toPostalCode: postalCode,
    products: completeMeasurements ? products : null,
    ownQuotes,
    options,
  });

  return {
    sellerId,
    storeName: store?.name ?? "Loja",
    quotes: [...ownQuotes, ...providerQuotes.map(toCheckoutShippingQuote)],
  };
}

function toMeasuredShippingProduct(item: ShippingCartItem): ShippingProduct | null {
  const measurements = getPackageMeasurements(item.variant, item.variant.product);
  if (!measurements) return null;
  return {
    id: item.variant.sku,
    ...measurements,
    // Valor UNITÁRIO: o Melhor Envio multiplica o `insurance_value` pela `quantity`.
    insuranceValueInCents: getCurrentPriceInCents(item.variant),
    quantity: item.quantity,
  };
}

async function findQuotableVariant(variantId: string) {
  const variant = await db.productVariant.findFirst({
    where: purchasableVariantWhere(variantId, { requireStock: true }),
    include: { inventory: true, product: { include: { store: true } } },
  });
  if (!variant?.product)
    throw new ApplicationError({ code: "NOT_FOUND", message: "Esta opção não está disponível para entrega." });
  return variant;
}

async function quoteSellerOwnShipping(sellerId: string, postalCode: string): Promise<CheckoutShippingQuote[]> {
  const methods = await db.sellerShippingMethod.findMany({ where: { sellerId, active: true } });
  return quoteOwnShipping(methods, postalCode);
}

async function hasShippingIntegration(sellerId: string, fromPostalCode: string | null | undefined): Promise<boolean> {
  if (!fromPostalCode) return false;
  const integration = await db.sellerShippingIntegration.findUnique({ where: { sellerId }, select: { id: true } });
  return integration !== null;
}

/**
 * Quotes through the seller's Melhor Envio account when it is connected and every product is
 * measured. A provider or token failure only surfaces when the seller has no own shipping to fall back on.
 */
async function quoteProviderShipping(input: {
  sellerId: string;
  hasIntegration: boolean;
  fromPostalCode: string | null | undefined;
  toPostalCode: string;
  products: ShippingProduct[] | null;
  ownQuotes: readonly CheckoutShippingQuote[];
  options: QuoteOptions;
}): Promise<ShippingQuote[]> {
  const { sellerId, fromPostalCode, products } = input;
  if (!input.hasIntegration || !fromPostalCode || !products) return [];

  try {
    // Token expirado, renovação recusada ou ilegível também cai para o frete próprio.
    const accessToken = await getSellerMelhorEnvioAccessToken(sellerId);
    if (!accessToken) return [];
    return await quoteIntegratedShipping(
      sellerId,
      { fromPostalCode, toPostalCode: input.toPostalCode, products },
      accessToken,
      input.options,
    );
  } catch (error) {
    if (input.ownQuotes.length === 0) throw error;
    logger.warn({ event: "shipping.integrated_quote_unavailable", sellerId });
    return [];
  }
}

function toCheckoutShippingQuote(quote: ShippingQuote): CheckoutShippingQuote {
  return {
    provider: quote.provider,
    serviceCode: quote.serviceCode,
    carrier: quote.carrier,
    service: quote.service,
    priceInCents: quote.priceInCents,
    ...(quote.estimatedDeliveryDays !== undefined ? { estimatedDeliveryDays: quote.estimatedDeliveryDays } : {}),
  };
}
