import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  quote: vi.fn(),
  findMethods: vi.fn(),
  findIntegration: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/config/env", () => ({ env: {} }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/database", () => ({
  db: {
    sellerShippingMethod: { findMany: mocks.findMethods },
    sellerShippingIntegration: { findUnique: mocks.findIntegration },
  },
}));
vi.mock("@/lib/shipping/melhor-envio-provider", () => ({ melhorEnvioProvider: { quote: mocks.quote } }));
vi.mock("@/modules/shipping/infrastructure/melhor-envio-oauth", () => ({
  getSellerMelhorEnvioAccessToken: mocks.getToken,
}));
vi.mock("@/shared/rate-limit/consume-rate-limit", () => ({ consumeRateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/modules/cart/queries/cart", () => ({ getActiveCart: vi.fn() }));
vi.mock("@/modules/products/application/purchasable-variant", () => ({ purchasableVariantWhere: vi.fn() }));

import { quoteShippingForCart } from "./shipping-quotes";

const variant = {
  sku: "SKU-1",
  priceInCents: 10_000,
  promotionalPriceInCents: null,
  promotionStartsAt: null,
  promotionEndsAt: null,
  widthInMillimeters: 100,
  heightInMillimeters: 50,
  lengthInMillimeters: 200,
  weightInGrams: 500,
  product: {
    sellerId: "seller-1",
    store: { name: "Loja", originPostalCode: "01001000" },
    widthInMillimeters: null,
    heightInMillimeters: null,
    lengthInMillimeters: null,
    weightInGrams: null,
  },
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findMethods.mockResolvedValue([]);
  mocks.findIntegration.mockResolvedValue({ id: "integration-1" });
  mocks.getToken.mockResolvedValue("seller-token");
  mocks.quote.mockResolvedValue([
    { provider: "MELHOR_ENVIO", serviceCode: "1", carrier: "Correios", service: "PAC", priceInCents: 2500, raw: {} },
  ]);
});

describe("quoteShippingForCart", () => {
  it("sends the unit insurance value with the quantity so the provider multiplies it only once", async () => {
    await quoteShippingForCart({ items: [{ quantity: 3, variant }] } as never, "01310000");

    expect(mocks.quote).toHaveBeenCalledWith(
      {
        fromPostalCode: "01001000",
        toPostalCode: "01310000",
        products: [expect.objectContaining({ id: "SKU-1", insuranceValueInCents: 10_000, quantity: 3 })],
      },
      "seller-token",
    );
  });
});
