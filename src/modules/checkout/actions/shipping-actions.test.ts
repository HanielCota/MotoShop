import { afterEach, beforeEach, expect, it, vi } from "vitest";

const quotes = vi.hoisted(() => vi.fn());
const cartQuotes = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("../application/shipping-quotes", () => ({
  quoteShippingForActiveCart: cartQuotes,
  quoteShippingForVariant: quotes,
}));

const limits = vi.hoisted(() => ({
  consume: vi.fn(),
  identity: vi.fn(),
  headers: vi.fn(),
}));
vi.mock("@/shared/rate-limit/consume-rate-limit", () => ({ consumeRateLimit: limits.consume }));
vi.mock("@/modules/cart/infrastructure/cart-access", () => ({ getCartIdentity: limits.identity }));
vi.mock("next/headers", () => ({ headers: limits.headers }));

import { quoteProductShippingAction, quoteShippingAction } from "./shipping-actions";

beforeEach(() => {
  limits.consume.mockResolvedValue({ allowed: true, retryAfter: null });
  limits.identity.mockResolvedValue({ guestAccessTokenHash: "guest-hash" });
  limits.headers.mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }));
});

afterEach(() => vi.resetAllMocks());

it("limits product quotes per visitor and per address before calling the provider", async () => {
  quotes.mockResolvedValue([]);

  await quoteProductShippingAction({ variantId: "cm123456789012345678901234", postalCode: "12345678" });

  expect(limits.identity).toHaveBeenCalledWith(true);
  expect(limits.consume).toHaveBeenCalledWith({ key: "shipping-quote:guest:guest-hash", windowSeconds: 60, max: 20 });
  expect(limits.consume).toHaveBeenCalledWith({ key: "shipping-quote:ip:203.0.113.7", windowSeconds: 60, max: 60 });
});

it("returns a friendly error and skips the quote when the visitor is rate limited", async () => {
  limits.identity.mockResolvedValue({ userId: "user-1" });
  limits.consume.mockResolvedValueOnce({ allowed: false, retryAfter: 30 });

  const result = await quoteShippingAction("12345-678");

  expect(result.error).toMatch(/muitas consultas de frete/i);
  expect(cartQuotes).not.toHaveBeenCalled();
  expect(limits.consume).toHaveBeenCalledWith(expect.objectContaining({ key: "shipping-quote:user:user-1" }));
});

it("normalizes a manually entered CEP and requests the chosen variant only", async () => {
  quotes.mockResolvedValue([{ sellerId: "seller-1", storeName: "Loja", quotes: [] }]);

  const result = await quoteProductShippingAction({ variantId: "cm123456789012345678901234", postalCode: "12345-678" });

  expect(quotes).toHaveBeenCalledWith("cm123456789012345678901234", "12345678");
  expect(result.quotes).toHaveLength(1);
});

it("rejects an invalid CEP before calling the shipping provider", async () => {
  const result = await quoteProductShippingAction({ variantId: "cm123456789012345678901234", postalCode: "12" });

  expect(result.error).toBe("Informe um CEP com 8 números.");
  expect(quotes).not.toHaveBeenCalled();
});

it.each([null, undefined, 12345678])(
  "rejects a non-string cart CEP payload (%s) without throwing",
  async (postalCode) => {
    const result = await quoteShippingAction(postalCode);

    expect(result.error).toBeTruthy();
    expect(cartQuotes).not.toHaveBeenCalled();
  },
);
