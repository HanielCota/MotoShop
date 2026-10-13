import { slugify } from "@/lib/utils";
import { parsePriceInputToCents } from "../domain/price-input";
import { measurementFields, parseOptionalInteger, parsePromotionDate } from "../domain/product-commercial-fields";
import { productInputSchema } from "./product-input";
export function parseProductForm(formData: FormData) {
  const variantTitles = formData.getAll("variantTitle");
  const variantSkus = formData.getAll("sku");
  const variantPrices = formData.getAll("price");
  const variantStocks = formData.getAll("stock");
  const variantIds = formData.getAll("variantId");
  const variantGenders = formData.getAll("variantGender");
  const variantColors = formData.getAll("variantColor");
  const variantSizes = formData.getAll("variantSize");

  return productInputSchema.safeParse({
    ...Object.fromEntries(measurementFields.map(({ name }) => [name, parseOptionalInteger(formData.get(name))])),
    name: formData.get("name"),
    slug: slugify(String(formData.get("slug") || formData.get("name") || "")),
    description: formData.get("description"),
    categoryId: formData.get("categoryId"),
    brandId: formData.get("brandId"),
    variants: variantTitles.map((_, index) => ({
      ...Object.fromEntries(
        measurementFields.map(({ name }) => [name, parseOptionalInteger(formData.getAll(`variant_${name}`)[index])]),
      ),
      promotionalPriceInCents: formData.getAll("promotionalPrice")[index]
        ? parsePriceInputToCents(formData.getAll("promotionalPrice")[index])
        : null,
      promotionStartsAt: parsePromotionDate(formData.getAll("promotionStartsAt")[index]),
      promotionEndsAt: parsePromotionDate(formData.getAll("promotionEndsAt")[index]),
      id: typeof variantIds[index] === "string" && variantIds[index] ? variantIds[index] : undefined,
      title: variantTitles[index],
      gender: variantGenders[index] || null,
      color: variantColors[index] ?? null,
      size: variantSizes[index] ?? null,
      sku: variantSkus[index],
      priceInCents: parsePriceInputToCents(variantPrices[index]),
      stock: variantStocks[index],
    })),
    motorcycleFitmentIds: formData
      .getAll("motorcycleFitmentIds")
      .filter((value): value is string => typeof value === "string"),
  });
}
