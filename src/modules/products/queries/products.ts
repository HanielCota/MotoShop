import "server-only";

import { Prisma, ProductStatus } from "@/generated/prisma/client";
import { db } from "@/lib/database";

import { rankProducts } from "../domain/product-ranking";
import { getCurrentPriceInCents, hasActivePromotion } from "../domain/pricing";
import type { ProductSort } from "../search-params";
import type { SellerProductSort, SellerProductStatus, SellerProductStock } from "../seller-search-params";

function parseProductReviewDate(value: string | null | undefined, endOfDay: boolean) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

export async function listProductCategories() {
  return db.category.findMany({
    where: { active: true },
    include: { parent: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function listProductBrands() {
  return db.brand.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export async function listSellerProducts(
  sellerId: string,
  input: {
    query?: string | null;
    categoryId?: string | null;
    brandId?: string | null;
    minPriceInCents?: number | null;
    maxPriceInCents?: number | null;
    status?: SellerProductStatus;
    stock?: SellerProductStock;
    promotion?: "ALL" | "ON_SALE";
    sort?: SellerProductSort;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 50);
  const requestedPage = Math.max(input.page ?? 1, 1);
  const query = input.query?.trim();
  const status = input.status && input.status !== "ALL" ? (input.status as ProductStatus) : undefined;
  const minPrice = typeof input.minPriceInCents === "number" && Number.isSafeInteger(input.minPriceInCents) && input.minPriceInCents >= 0 ? input.minPriceInCents : undefined;
  const maxPrice = typeof input.maxPriceInCents === "number" && Number.isSafeInteger(input.maxPriceInCents) && input.maxPriceInCents >= 0 ? input.maxPriceInCents : undefined;
  const variantFilter: Prisma.ProductVariantWhereInput = {
    ...(minPrice !== undefined || maxPrice !== undefined ? { active: true } : {}),
    ...(input.stock === "OUT" ? { active: true, inventory: { availableQuantity: 0 } } : {}),
    ...(input.stock === "IN" ? { active: true, inventory: { availableQuantity: { gt: 0 } } } : {}),
    ...(input.stock === "LOW" ? { active: true, inventory: { availableQuantity: { gt: 0, lte: 5 } } } : {}),
    ...(input.promotion === "ON_SALE"
      ? {
          active: true,
          promotionalPriceInCents: { not: null },
          AND: [
            { OR: [{ promotionStartsAt: null }, { promotionStartsAt: { lte: new Date() } }] },
            { OR: [{ promotionEndsAt: null }, { promotionEndsAt: { gte: new Date() } }] },
          ],
        }
      : {}),
    ...(minPrice !== undefined || maxPrice !== undefined
      ? { priceInCents: { ...(minPrice !== undefined ? { gte: minPrice } : {}), ...(maxPrice !== undefined ? { lte: maxPrice } : {}) } }
      : {}),
  };
  const where: Prisma.ProductWhereInput = {
    sellerId,
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.brandId ? { brandId: input.brandId } : {}),
    ...(status ? { status } : {}),
    ...(Object.keys(variantFilter).length ? { variants: { some: variantFilter } } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { slug: { contains: query, mode: "insensitive" as const } },
            { variants: { some: { sku: { contains: query, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };
  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      include: {
        category: true,
        brand: true,
        variants: { include: { inventory: true }, orderBy: { createdAt: "asc" } },
      },
      orderBy:
        input.sort === "updated_oldest"
          ? [{ updatedAt: "asc" }, { name: "asc" }]
          : input.sort === "name_asc"
            ? [{ name: "asc" }, { updatedAt: "desc" }]
            : input.sort === "name_desc"
              ? [{ name: "desc" }, { updatedAt: "desc" }]
              : [{ updatedAt: "desc" }, { name: "asc" }],
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  return { products, total, page: Math.min(requestedPage, pageCount), pageCount };
}

export async function listProductReviewQueue(
  input: {
    status?: "ALL" | "SUBMITTED" | "REJECTED";
    q?: string | null;
    categoryId?: string | null;
    brandId?: string | null;
    sellerId?: string | null;
    from?: string | null;
    to?: string | null;
    sort?: "newest" | "oldest";
    page?: number;
  } = {},
) {
  const pageSize = 20;
  const requestedPage = Math.max(input.page ?? 1, 1);
  const status = input.status && input.status !== "ALL" ? input.status : undefined;
  const query = input.q?.trim().slice(0, 100);
  const from = parseProductReviewDate(input.from, false);
  const to = parseProductReviewDate(input.to, true);
  const where = {
    status: status ?? { in: [ProductStatus.SUBMITTED, ProductStatus.REJECTED] },
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.brandId ? { brandId: input.brandId } : {}),
    ...(input.sellerId ? { sellerId: input.sellerId } : {}),
    ...(from || to ? { submittedAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { slug: { contains: query, mode: "insensitive" as const } },
            { seller: { store: { name: { contains: query, mode: "insensitive" as const } } } },
            { variants: { some: { sku: { contains: query, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };
  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      include: {
        seller: { include: { store: true } },
        category: true,
        brand: true,
        variants: { include: { inventory: true } },
      },
      orderBy: [
        { submittedAt: input.sort === "newest" ? "desc" : "asc" },
        { createdAt: input.sort === "newest" ? "desc" : "asc" },
      ],
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  return { products, total, page: Math.min(requestedPage, pageCount), pageCount };
}

export async function listApprovedProducts(input?: {
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
}) {
  const query = input?.query?.trim();
  const pageSize = Math.min(Math.max(input?.pageSize ?? 12, 1), 48);
  const requestedPage = Math.max(input?.page ?? 1, 1);
  const now = new Date();
  const products = await db.product.findMany({
    where: {
      status: ProductStatus.APPROVED,
      seller: { status: { in: ["APPROVED", "ACTIVE"] }, ...(input?.sellerId ? { id: input.sellerId } : {}) },
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
              { brand: { name: { contains: query, mode: "insensitive" } } },
              { category: { name: { contains: query, mode: "insensitive" } } },
              { seller: { store: { name: { contains: query, mode: "insensitive" } } } },
              { variants: { some: { sku: { contains: query, mode: "insensitive" } } } },
            ],
          }
        : {}),
      ...(input?.motorcycleFitmentIds?.length
        ? { compatibilities: { some: { motorcycleFitmentId: { in: input.motorcycleFitmentIds } } } }
        : input?.motorcycleFitmentId
          ? { compatibilities: { some: { motorcycleFitmentId: input.motorcycleFitmentId } } }
          : {}),
      ...(input?.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input?.brandId ? { brandId: input.brandId } : {}),
      ...(input?.availability === "IN_STOCK"
        ? { variants: { some: { active: true, inventory: { availableQuantity: { gt: 0 } } } } }
        : input?.availability === "OUT_OF_STOCK"
          ? { variants: { none: { active: true, inventory: { availableQuantity: { gt: 0 } } } } }
          : {}),
    },
    include: {
      seller: {
        include: {
          store: true,
          subscriptions: {
            where: { status: "ACTIVE", startsAt: { lte: now }, endsAt: { gte: now } },
            select: { id: true, endsAt: true },
          },
        },
      },
      category: true,
      brand: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      variants: { where: { active: true }, include: { inventory: true } },
      _count: { select: { productReviews: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const requestedMinPrice = input?.minPriceInCents;
  const requestedMaxPrice = input?.maxPriceInCents;
  const minPriceInCents =
    requestedMinPrice !== null &&
    requestedMinPrice !== undefined &&
    Number.isSafeInteger(requestedMinPrice) &&
    requestedMinPrice >= 0
      ? requestedMinPrice
      : undefined;
  const maxPriceInCents =
    requestedMaxPrice !== null &&
    requestedMaxPrice !== undefined &&
    Number.isSafeInteger(requestedMaxPrice) &&
    requestedMaxPrice >= 0
      ? requestedMaxPrice
      : undefined;
  const priceFilteredProducts = products.filter((product) => {
    if (input?.promotion === "ON_SALE" && !product.variants.some((variant) => hasActivePromotion(variant, now))) {
      return false;
    }
    if (minPriceInCents === undefined && maxPriceInCents === undefined) return true;
    return product.variants.some((variant) => {
      const price = getCurrentPriceInCents(variant, now);
      return (minPriceInCents === undefined || price >= minPriceInCents) &&
        (maxPriceInCents === undefined || price <= maxPriceInCents);
    });
  });

  const rankedProducts = rankProducts(
    priceFilteredProducts.map((product) => ({
      ...product,
      isInStock: product.variants.some((variant) => (variant.inventory?.availableQuantity ?? 0) > 0),
      reviewCount: product._count.productReviews,
      isVip: product.seller.subscriptions.length > 0,
    })),
    query,
  );

  const sortedProducts = [...rankedProducts].sort((a, b) => {
    if (input?.sort === "newest") return b.createdAt.getTime() - a.createdAt.getTime();
    if (input?.sort === "price_asc" || input?.sort === "price_desc") {
      const aPrice = a.variants[0] ? getCurrentPriceInCents(a.variants[0], now) : Number.MAX_SAFE_INTEGER;
      const bPrice = b.variants[0] ? getCurrentPriceInCents(b.variants[0], now) : Number.MAX_SAFE_INTEGER;
      return input.sort === "price_asc" ? aPrice - bPrice : bPrice - aPrice;
    }
    return 0;
  });

  const total = sortedProducts.length;
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  const page = Math.min(requestedPage, pageCount);
  return { products: sortedProducts.slice((page - 1) * pageSize, page * pageSize), total, page, pageCount };
}

export async function getApprovedProductBySlug(
  slug: string,
  input: {
    reviewRating?: number | null;
    reviewSort?: "newest" | "oldest";
    reviewPage?: number;
    questionPage?: number;
    questionSort?: "newest" | "oldest";
  } = {},
) {
  const pageSize = 6;
  const requestedReviewPage = Math.max(input.reviewPage ?? 1, 1);
  const requestedQuestionPage = Math.max(input.questionPage ?? 1, 1);
  const reviewRating = typeof input.reviewRating === "number" && Number.isInteger(input.reviewRating) && input.reviewRating >= 1 && input.reviewRating <= 5 ? input.reviewRating : undefined;
  const now = new Date();
  const product = await db.product.findFirst({
    where: { slug, status: ProductStatus.APPROVED, seller: { status: { in: ["APPROVED", "ACTIVE"] } } },
    include: {
      seller: {
        include: {
          store: true,
          subscriptions: {
            where: { status: "ACTIVE", startsAt: { lte: now }, endsAt: { gte: now } },
            select: { id: true, endsAt: true },
          },
          sellerReviews: {
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      category: true,
      brand: true,
      images: { orderBy: { sortOrder: "asc" } },
      variants: { where: { active: true }, include: { inventory: true }, orderBy: { createdAt: "asc" } },
      compatibilities: {
        include: { motorcycleFitment: { include: { motorcycleModel: { include: { manufacturer: true } } } } },
      },
      productReviews: {
        ...(reviewRating ? { where: { rating: reviewRating } } : {}),
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: input.reviewSort === "oldest" ? "asc" : "desc" },
        skip: (requestedReviewPage - 1) * pageSize,
        take: pageSize,
      },
      questions: {
        include: {
          askedBy: { select: { name: true } },
          answeredBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (requestedQuestionPage - 1) * pageSize,
        take: pageSize,
      },
      _count: { select: { productReviews: true, questions: true } },
    },
  });

  if (!product) return null;

  const [reviewSummary, reviewCount] = await Promise.all([
    db.productReview.aggregate({ where: { productId: product.id, ...(reviewRating ? { rating: reviewRating } : {}) }, _avg: { rating: true } }),
    db.productReview.count({ where: { productId: product.id, ...(reviewRating ? { rating: reviewRating } : {}) } }),
  ]);
  const reviewPageCount = Math.max(Math.ceil(reviewCount / pageSize), 1);
  const questionPageCount = Math.max(Math.ceil(product._count.questions / pageSize), 1);

  return {
    ...product,
    productReviewAverage: reviewSummary._avg.rating,
    productReviewCount: reviewCount,
    questionCount: product._count.questions,
    reviewPage: Math.min(requestedReviewPage, reviewPageCount),
    reviewPageCount,
    questionPage: Math.min(requestedQuestionPage, questionPageCount),
    questionPageCount,
  };
}

export async function getApprovedProductSeoBySlug(slug: string) {
  return db.product.findFirst({
    where: { slug, status: ProductStatus.APPROVED, seller: { status: { in: ["APPROVED", "ACTIVE"] } } },
    select: {
      name: true,
      slug: true,
      description: true,
      updatedAt: true,
      category: { select: { name: true } },
      brand: { select: { name: true } },
      images: { select: { storageKey: true }, orderBy: { sortOrder: "asc" }, take: 4 },
      variants: {
        where: { active: true },
        select: {
          priceInCents: true,
          promotionalPriceInCents: true,
          promotionStartsAt: true,
          promotionEndsAt: true,
        },
      },
      productReviews: { select: { rating: true } },
    },
  });
}
