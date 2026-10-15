import { expect, it } from "vitest";

import { loadSellerProductSearchParams, serializeSellerProductSearchParams } from "./seller-search-params";

it("reads the price filters typed in reais and hands cents to the query", () => {
  const params = loadSellerProductSearchParams({ productMinPrice: "50,00", productMaxPrice: "1000" });

  expect(params.productMinPrice).toBe(5000);
  expect(params.productMaxPrice).toBe(100000);
});

it("ignores a price filter that is not a valid amount in reais", () => {
  const params = loadSellerProductSearchParams({ productMinPrice: "-5", productMaxPrice: "abc" });

  expect(params.productMinPrice).toBeNull();
  expect(params.productMaxPrice).toBeNull();
});

it("keeps the price in reais when building pagination links", () => {
  const url = serializeSellerProductSearchParams("/seller/products", { productMinPrice: 5050 });

  expect(decodeURIComponent(url)).toBe("/seller/products?productMinPrice=50,50");
});
