import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { isVariantGender, VARIANT_ATTRIBUTE_MAX_LENGTH, type VariantGenderValue } from "../domain/variant-attributes";
import type { ProductSort } from "../search-params";

export type PublicProductFilter = {
  query?: string | null;
  motorcycleFitmentId?: string | null;
  motorcycleFitmentIds?: string[] | null;
  categoryId?: string | null;
  brandId?: string | null;
  sellerId?: string | null;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
  availability?: "ALL" | "IN_STOCK" | "OUT_OF_STOCK";
  minPriceInCents?: number | null;
  maxPriceInCents?: number | null;
  promotion?: "ALL" | "ON_SALE";
  /** Variant attributes; the same active variant must match every attribute given. */
  gender?: VariantGenderValue | null;
  color?: string | null;
  size?: string | null;
};

/**
 * "recent_offers": products with an active promotion first, newest offer first. An offer without a
 * start date counts from the variant's last update, when the promotional price was set.
 */
const orderBySort: Record<ProductSort, Prisma.Sql> = {
  relevance: Prisma.sql`score DESC`,
  newest: Prisma.sql`"createdAt" DESC`,
  recent_offers: Prisma.sql`"onSale" DESC, "offerStartedAt" DESC NULLS LAST`,
  price_asc: Prisma.sql`price ASC`,
  price_desc: Prisma.sql`price DESC`,
};

function normalizeAttribute(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed && trimmed.length <= VARIANT_ATTRIBUTE_MAX_LENGTH ? trimmed : null;
}

// Color and size compare without case, like buildVariantAttributeWhere in variant-attribute-options.ts.
function variantAttributeCondition(input: PublicProductFilter) {
  const gender = isVariantGender(input.gender) ? input.gender : null;
  const color = normalizeAttribute(input.color);
  const size = normalizeAttribute(input.size);
  if (!gender && !color && !size) return Prisma.empty;

  return Prisma.sql`AND EXISTS (SELECT 1 FROM product_variants va WHERE va."productId" = p.id AND va.active = true
      ${gender ? Prisma.sql`AND va.gender = ${gender}::"VariantGender"` : Prisma.empty}
      ${color ? Prisma.sql`AND lower(va.color) = lower(${color})` : Prisma.empty}
      ${size ? Prisma.sql`AND lower(va.size) = lower(${size})` : Prisma.empty})`;
}

function nonNegativeSafeInteger(value: number | null | undefined) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

// PostgreSQL computes the same small ranking signals as product-ranking.ts before
// pagination. Raw SQL stays encapsulated here; values are always bound parameters.
export async function findPublicProductPage(input: PublicProductFilter, now: Date) {
  const size = Math.min(Math.max(input.pageSize ?? 12, 1), 48);
  const requestedPage = Math.max(input.page ?? 1, 1);
  const query = input.query?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const fitments = input.motorcycleFitmentIds?.length
    ? input.motorcycleFitmentIds
    : input.motorcycleFitmentId
      ? [input.motorcycleFitmentId]
      : [];
  const min = nonNegativeSafeInteger(input.minPriceInCents);
  const max = nonNegativeSafeInteger(input.maxPriceInCents);
  const cte = Prisma.sql`WITH offers AS (
    SELECT v."productId", v.sku,
      CASE WHEN v."promotionalPriceInCents" IS NOT NULL AND (v."promotionStartsAt" IS NULL OR v."promotionStartsAt" <= ${now}) AND (v."promotionEndsAt" IS NULL OR v."promotionEndsAt" >= ${now}) THEN v."promotionalPriceInCents" ELSE v."priceInCents" END AS price,
      (v."promotionalPriceInCents" IS NOT NULL AND (v."promotionStartsAt" IS NULL OR v."promotionStartsAt" <= ${now}) AND (v."promotionEndsAt" IS NULL OR v."promotionEndsAt" >= ${now})) AS sale,
      COALESCE(i."availableQuantity", 0) > 0 AS available,
      v."promotionStartsAt", v."updatedAt" AS "variantUpdatedAt"
    FROM product_variants v LEFT JOIN inventories i ON i."variantId" = v.id WHERE v.active = true
  ), matches AS (
    SELECT p.id, p."createdAt", MIN(o.price) AS price, bool_or(o.sale) AS "onSale",
      MAX(CASE WHEN o.sale THEN COALESCE(o."promotionStartsAt", o."variantUpdatedAt") END) AS "offerStartedAt",
      (CASE WHEN ${query} = '' THEN 0 WHEN lower(trim(p.name)) = ${query} THEN 100 WHEN starts_with(lower(trim(p.name)), ${query}) THEN 50 WHEN strpos(lower(trim(p.name)), ${query}) > 0 THEN 20 ELSE 0 END
      + CASE WHEN bool_or(o.available) THEN 10 ELSE 0 END
      + LEAST((SELECT count(*) FROM product_reviews r WHERE r."productId" = p.id AND r."hiddenAt" IS NULL), 5)
      + CASE WHEN EXISTS (SELECT 1 FROM seller_subscriptions vip WHERE vip."sellerId" = p."sellerId" AND vip.status = 'ACTIVE' AND vip."startsAt" <= ${now} AND vip."endsAt" >= ${now}) THEN 5 ELSE 0 END) AS score
    FROM products p JOIN sellers s ON s.id = p."sellerId" JOIN stores st ON st.id = p."storeId"
      JOIN categories c ON c.id = p."categoryId" JOIN brands b ON b.id = p."brandId" JOIN offers o ON o."productId" = p.id
    WHERE p.status = 'APPROVED' AND s.status IN ('APPROVED', 'ACTIVE') AND c.active = true AND b.active = true
      ${input.categoryId ? Prisma.sql`AND p."categoryId" = ${input.categoryId}` : Prisma.empty}
      ${input.brandId ? Prisma.sql`AND p."brandId" = ${input.brandId}` : Prisma.empty}
      ${input.sellerId ? Prisma.sql`AND p."sellerId" = ${input.sellerId}` : Prisma.empty}
      ${variantAttributeCondition(input)}
      ${fitments.length ? Prisma.sql`AND EXISTS (SELECT 1 FROM product_compatibilities pc WHERE pc."productId" = p.id AND pc."motorcycleFitmentId" IN (${Prisma.join(fitments)}))` : Prisma.empty}
      ${query ? Prisma.sql`AND (p.name ILIKE ${pattern} OR p.description ILIKE ${pattern} OR b.name ILIKE ${pattern} OR c.name ILIKE ${pattern} OR st.name ILIKE ${pattern} OR EXISTS (SELECT 1 FROM offers sk WHERE sk."productId" = p.id AND sk.sku ILIKE ${pattern}))` : Prisma.empty}
    GROUP BY p.id
    HAVING true
      ${input.availability === "IN_STOCK" ? Prisma.sql`AND bool_or(o.available)` : input.availability === "OUT_OF_STOCK" ? Prisma.sql`AND NOT bool_or(o.available)` : Prisma.empty}
      ${input.promotion === "ON_SALE" ? Prisma.sql`AND bool_or(o.sale)` : Prisma.empty}
      ${min !== null || max !== null ? Prisma.sql`AND bool_or((${min}::bigint IS NULL OR o.price >= ${min}::bigint) AND (${max}::bigint IS NULL OR o.price <= ${max}::bigint))` : Prisma.empty}
  )`;
  const counts = await db.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`${cte} SELECT count(*) AS total FROM matches`);
  const total = Number(counts[0]?.total ?? 0);
  const pageCount = Math.max(Math.ceil(total / size), 1);
  const page = Math.min(requestedPage, pageCount);
  const order = orderBySort[input.sort ?? "relevance"];
  const rows = await db.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`${cte} SELECT id FROM matches ORDER BY ${order}, "createdAt" DESC, id ASC LIMIT ${size} OFFSET ${(page - 1) * size}`,
  );
  return { ids: rows.map((row) => row.id), total, page, pageCount };
}
