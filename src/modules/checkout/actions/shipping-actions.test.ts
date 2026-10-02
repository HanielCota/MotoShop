import { afterEach, expect, it, vi } from "vitest";

const quotes = vi.hoisted(() => vi.fn());
const cartQuotes = vi.hoisted(() => vi.fn());
vi.mock("../application/shipping-quotes", () => ({
  quoteShippingForActiveCart: cartQuotes,
  quoteShippingForVariant: quotes,
}));

import { quoteProductShippingAction, quoteShippingAction } from "./shipping-actions";

afterEach(() => vi.resetAllMocks());

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
