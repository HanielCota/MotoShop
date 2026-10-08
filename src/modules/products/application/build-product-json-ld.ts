import type { ProductOfferSummary } from "../domain/product-offer-summary";

type JsonLdProduct = {
  name: string;
  slug: string;
  description: string;
  category: { name: string };
  brand: { name: string };
  variantCount: number;
  imageUrls: string[];
  reviewAverage: number | null;
  reviewCount: number;
};

/** Monta o JSON-LD schema.org/Product exibido na página pública do produto. */
export function buildProductJsonLd(product: JsonLdProduct, offer: ProductOfferSummary, baseUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    category: product.category.name,
    brand: { "@type": "Brand", name: product.brand.name },
    image: product.imageUrls,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "BRL",
      lowPrice: offer.lowestPriceInCents !== null ? offer.lowestPriceInCents / 100 : undefined,
      highPrice: offer.highestPriceInCents !== null ? offer.highestPriceInCents / 100 : undefined,
      offerCount: product.variantCount,
      availability: `https://schema.org/${offer.hasStock ? "InStock" : "OutOfStock"}`,
      url: `${baseUrl}/products/${product.slug}`,
    },
    ...(product.reviewAverage
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.reviewAverage,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  };
}

/** Serializa o JSON-LD escapando `<` para não fechar a tag <script>. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
