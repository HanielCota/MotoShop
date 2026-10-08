import "server-only";

import { cache } from "react";

import { Prisma, ProductStatus } from "@/generated/prisma/client";
import { db } from "@/lib/database";

import { buildRatingDistribution } from "../domain/review-distribution";
import { netUnitsSold, SALE_REVERSING_RETURN_STATUSES, SOLD_SELLER_ORDER_STATUSES } from "../domain/units-sold";

import { findPublicProductPage, type PublicProductFilter } from "./public-product-page";
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
  const minPrice =
    typeof input.minPriceInCents === "number" &&
    Number.isSafeInteger(input.minPriceInCents) &&
    input.minPriceInCents >= 0
      ? input.minPriceInCents
      : undefined;
  const maxPrice =
    typeof input.maxPriceInCents === "number" &&
    Number.isSafeInteger(input.maxPriceInCents) &&
    input.maxPriceInCents >= 0
      ? input.maxPriceInCents
      : undefined;
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
      ? {
          priceInCents: {
            ...(minPrice !== undefined ? { gte: minPrice } : {}),
            ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
          },
        }
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
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        compatibilities: {
          include: { motorcycleFitment: { include: { motorcycleModel: { include: { manufacturer: true } } } } },
        },
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

export async function listApprovedProducts(input: PublicProductFilter = {}) {
  const now = new Date();
  const page = await findPublicProductPage(input, now);
  const products = await db.product.findMany({
    where: {
      id: { in: page.ids },
      status: "APPROVED",
      seller: { status: { in: ["APPROVED", "ACTIVE"] } },
      category: { active: true },
      brand: { active: true },
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
      _count: { select: { productReviews: { where: { hiddenAt: null } } } },
    },
  });
  const positions = new Map(page.ids.map((id, index) => [id, index]));
  return {
    products: products
      .map((product) => ({
        ...product,
        isInStock: product.variants.some((variant) => (variant.inventory?.availableQuantity ?? 0) > 0),
        reviewCount: product._count.productReviews,
        isVip: product.seller.subscriptions.length > 0,
      }))
      .sort((a, b) => positions.get(a.id)! - positions.get(b.id)!),
    total: page.total,
    page: page.page,
    pageCount: page.pageCount,
  };
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
  const reviewRating =
    typeof input.reviewRating === "number" &&
    Number.isInteger(input.reviewRating) &&
    input.reviewRating >= 1 &&
    input.reviewRating <= 5
      ? input.reviewRating
      : undefined;
  const now = new Date();
  const product = await db.product.findFirst({
    where: {
      slug,
      status: ProductStatus.APPROVED,
      category: { active: true },
      brand: { active: true },
      seller: { status: { in: ["APPROVED", "ACTIVE"] } },
    },
    include: {
      seller: {
        include: {
          store: true,
          subscriptions: {
            where: { status: "ACTIVE", startsAt: { lte: now }, endsAt: { gte: now } },
            select: { id: true, endsAt: true },
          },
          sellerReviews: {
            where: { hiddenAt: null },
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
        where: { hiddenAt: null, ...(reviewRating ? { ratingTenths: { gte: reviewRating * 10 } } : {}) },
        include: { user: { select: { name: true } }, media: { orderBy: { sortOrder: "asc" } } },
        orderBy: { createdAt: input.reviewSort === "oldest" ? "asc" : "desc" },
        skip: (requestedReviewPage - 1) * pageSize,
        take: pageSize,
      },
      questions: {
        where: { hiddenAt: null },
        include: {
          askedBy: { select: { name: true } },
          answeredBy: { select: { name: true } },
        },
        orderBy: { createdAt: input.questionSort === "oldest" ? "asc" : "desc" },
        skip: (requestedQuestionPage - 1) * pageSize,
        take: pageSize,
      },
      _count: { select: { productReviews: { where: { hiddenAt: null } }, questions: { where: { hiddenAt: null } } } },
    },
  });

  if (!product) return null;

  const reviewWhere: Prisma.ProductReviewWhereInput = {
    productId: product.id,
    hiddenAt: null,
    ...(reviewRating ? { ratingTenths: { gte: reviewRating * 10 } } : {}),
  };
  const [reviewSummary, reviewGroups, unitsSold] = await Promise.all([
    db.productReview.aggregate({ where: reviewWhere, _avg: { ratingTenths: true }, _count: { _all: true } }),
    db.productReview.groupBy({ by: ["ratingTenths"], where: reviewWhere, _count: { _all: true } }),
    getProductUnitsSold(product.id),
  ]);
  const reviewCount = reviewSummary._count._all;
  const reviewPageCount = Math.max(Math.ceil(reviewCount / pageSize), 1);
  const questionPageCount = Math.max(Math.ceil(product._count.questions / pageSize), 1);

  return {
    ...product,
    productReviewAverage: reviewSummary._avg.ratingTenths === null ? null : reviewSummary._avg.ratingTenths / 10,
    productReviewCount: reviewCount,
    reviewDistribution: buildRatingDistribution(
      reviewGroups.map((group) => ({ ratingTenths: group.ratingTenths, count: group._count._all })),
    ),
    unitsSold,
    questionCount: product._count.questions,
    reviewPage: Math.min(requestedReviewPage, reviewPageCount),
    reviewPageCount,
    questionPage: Math.min(requestedQuestionPage, questionPageCount),
    questionPageCount,
  };
}

/**
 * Unidades vendidas de um produto (regra em `domain/units-sold.ts`): itens de `SellerOrder`
 * com venda confirmada menos unidades de devoluções reembolsadas. Memoizado por request.
 */
export const getProductUnitsSold = cache(async (productId: string) => {
  const soldOrderItem = { productId, sellerOrder: { status: { in: [...SOLD_SELLER_ORDER_STATUSES] } } };
  const [sold, refunded] = await Promise.all([
    db.orderItem.aggregate({ where: soldOrderItem, _sum: { quantity: true } }),
    db.returnItem.aggregate({
      where: {
        orderItem: soldOrderItem,
        returnRequest: { status: { in: [...SALE_REVERSING_RETURN_STATUSES] } },
      },
      _sum: { quantity: true },
    }),
  ]);
  return netUnitsSold(sold._sum.quantity, refunded._sum.quantity);
});

export async function getApprovedProductSeoBySlug(slug: string) {
  return db.product.findFirst({
    where: {
      slug,
      status: ProductStatus.APPROVED,
      category: { active: true },
      brand: { active: true },
      seller: { status: { in: ["APPROVED", "ACTIVE"] } },
    },
    select: {
      name: true,
      slug: true,
      description: true,
      isDemo: true,
      updatedAt: true,
      category: { select: { name: true, slug: true } },
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
      productReviews: { where: { hiddenAt: null }, select: { ratingTenths: true } },
    },
  });
}
