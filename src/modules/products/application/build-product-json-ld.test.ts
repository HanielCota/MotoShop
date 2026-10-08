import { describe, expect, it } from "vitest";

import { buildProductJsonLd, serializeJsonLd } from "./build-product-json-ld";

const product = {
  name: "Capacete",
  slug: "capacete",
  description: "Leve",
  category: { name: "Capacetes" },
  brand: { name: "Marca" },
  variantCount: 2,
  imageUrls: ["https://cdn/a.jpg"],
  reviewAverage: 4.5,
  reviewCount: 3,
};

describe("buildProductJsonLd", () => {
  it("builds an aggregate offer in reais", () => {
    const jsonLd = buildProductJsonLd(
      product,
      { lowestPriceInCents: 10000, highestPriceInCents: 15000, hasPriceRange: true, hasStock: false, hasPromotion: false },
      "https://loja.test",
    );
    expect(jsonLd.offers).toMatchObject({
      lowPrice: 100,
      highPrice: 150,
      availability: "https://schema.org/OutOfStock",
      url: "https://loja.test/products/capacete",
    });
    expect(jsonLd).toHaveProperty("aggregateRating.reviewCount", 3);
  });

  it("escapes closing script tags", () => {
    expect(serializeJsonLd({ a: "</script>" })).not.toContain("</script>");
  });
});
