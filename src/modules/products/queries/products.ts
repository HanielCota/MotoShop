import "server-only";

import { cache } from "react";

import { Prisma, ProductStatus } from "@/generated/prisma/client";
import { db } from "@/lib/database";

import { buildRatingDistribution } from "../domain/review-distribution";
import { normalizeRequestedPage, resolvePage } from "../domain/pagination";
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

// Price columns are PostgreSQL INT4: larger URL values would make Prisma reject the query.
const MAX_INT4 = 2_147_483_647;

export async function listProductBrands() {
  return db.brand.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

type SellerProductListInput = {
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
};

export async function listSellerProducts(sellerId: string, input: SellerProductListInput = {}) {
  const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 50);
  const requestedPage = normalizeRequestedPage(input.page);
  const where = buildSellerProductWhere(sellerId, input);
  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      include: {
        category: true,
        brand: true,
        variants: { include: { inventory: true }, orderBy: { createdAt: "asc" } },
      },
      orderBy: sellerProductOrderBy(input.sort),
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  return { products, total, page: Math.min(requestedPage, pageCount), pageCount };
}

function parsePriceFilter(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return undefined;
  return Math.min(value, MAX_INT4);
}

function buildSellerProductWhere(sellerId: string, input: SellerProductListInput): Prisma.ProductWhereInput {
  const query = input.query?.trim();
  const status = input.status && input.status !== "ALL" ? (input.status as ProductStatus) : undefined;
  const variantFilter = buildSellerVariantFilter(input);
  return {
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
}

function buildSellerVariantFilter(input: SellerProductListInput): Prisma.ProductVariantWhereInput {
  const minPrice = parsePriceFilter(input.minPriceInCents);
  const maxPrice = parsePriceFilter(input.maxPriceInCents);
  const hasPriceFilter = minPrice !== undefined || maxPrice !== undefined;
  return {
    ...(hasPriceFilter ? { active: true } : {}),
    ...sellerStockFilter(input.stock),
    ...(input.promotion === "ON_SALE" ? activePromotionFilter() : {}),
    ...(hasPriceFilter
      ? {
          priceInCents: {
            ...(minPrice !== undefined ? { gte: minPrice } : {}),
            ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
          },
        }
      : {}),
  };
}

function sellerStockFilter(stock: SellerProductStock | undefined): Prisma.ProductVariantWhereInput {
  if (stock === "OUT") return { active: true, inventory: { availableQuantity: 0 } };
  if (stock === "IN") return { active: true, inventory: { availableQuantity: { gt: 0 } } };
  if (stock === "LOW") return { active: true, inventory: { availableQuantity: { gt: 0, lte: 5 } } };
  return {};
}

function activePromotionFilter(): Prisma.ProductVariantWhereInput {
  return {
    active: true,
    promotionalPriceInCents: { not: null },
    AND: [
      { OR: [{ promotionStartsAt: null }, { promotionStartsAt: { lte: new Date() } }] },
      { OR: [{ promotionEndsAt: null }, { promotionEndsAt: { gte: new Date() } }] },
    ],
  };
}

function sellerProductOrderBy(sort: SellerProductSort | undefined): Prisma.ProductOrderByWithRelationInput[] {
  if (sort === "updated_oldest") return [{ updatedAt: "asc" }, { name: "asc" }];
  if (sort === "name_asc") return [{ name: "asc" }, { updatedAt: "desc" }];
  if (sort === "name_desc") return [{ name: "desc" }, { updatedAt: "desc" }];
  return [{ updatedAt: "desc" }, { name: "asc" }];
}

type ProductReviewQueueInput = {
  status?: "ALL" | "SUBMITTED" | "REJECTED";
  q?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  sellerId?: string | null;
  from?: string | null;
  to?: string | null;
  sort?: "newest" | "oldest";
  page?: number;
};

const productReviewQueueInclude = {
  seller: { include: { store: true } },
  category: true,
  brand: true,
  variants: { include: { inventory: true } },
  images: { orderBy: { sortOrder: "asc" }, take: 1 },
  compatibilities: {
    include: { motorcycleFitment: { include: { motorcycleModel: { include: { manufacturer: true } } } } },
  },
} satisfies Prisma.ProductInclude;

export async function listProductReviewQueue(input: ProductReviewQueueInput = {}) {
  const pageSize = 20;
  const requestedPage = Math.max(input.page ?? 1, 1);
  const where = buildProductReviewQueueWhere(input);
  const sortDirection = input.sort === "newest" ? "desc" : "asc";
  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      include: productReviewQueueInclude,
      orderBy: [{ submittedAt: sortDirection }, { createdAt: sortDirection }],
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  return { products, total, page: Math.min(requestedPage, pageCount), pageCount };
}

function buildProductReviewQueueWhere(input: ProductReviewQueueInput): Prisma.ProductWhereInput {
  const status = input.status && input.status !== "ALL" ? input.status : undefined;
  const query = input.q?.trim().slice(0, 100);
  const from = parseProductReviewDate(input.from, false);
  const to = parseProductReviewDate(input.to, true);
  return {
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
      .sort((a, b) => (positions.get(a.id) ?? 0) - (positions.get(b.id) ?? 0)),
    total: page.total,
    page: page.page,
    pageCount: page.pageCount,
  };
}

type ProductDetailInput = {
  reviewRating?: number | null;
  reviewSort?: "newest" | "oldest";
  reviewPage?: number;
  questionPage?: number;
  questionSort?: "newest" | "oldest";
};

type ProductInteractionArgs = {
  pageSize: number;
  reviewRating: number | undefined;
  reviewSort: ProductDetailInput["reviewSort"];
  questionSort: ProductDetailInput["questionSort"];
};

export async function getApprovedProductBySlug(slug: string, input: ProductDetailInput = {}) {
  const requestedReviewPage = normalizeRequestedPage(input.reviewPage);
  const requestedQuestionPage = normalizeRequestedPage(input.questionPage);
  const interactionArgs: ProductInteractionArgs = {
    pageSize: 6,
    reviewRating: parseReviewRating(input.reviewRating),
    reviewSort: input.reviewSort,
    questionSort: input.questionSort,
  };
  const product = await db.product.findFirst({
    where: approvedProductWhere(slug),
    include: approvedProductDetailInclude(interactionArgs, requestedReviewPage, requestedQuestionPage, new Date()),
  });

  if (!product) return null;

  const reviewWhere = productReviewWhere(product.id, interactionArgs.reviewRating);
  const [reviewSummary, reviewGroups, unitsSold] = await Promise.all([
    db.productReview.aggregate({ where: reviewWhere, _avg: { ratingTenths: true }, _count: { _all: true } }),
    db.productReview.groupBy({ by: ["ratingTenths"], where: reviewWhere, _count: { _all: true } }),
    getProductUnitsSold(product.id),
  ]);
  const reviewCount = reviewSummary._count._all;
  const { pageSize } = interactionArgs;
  const { page: reviewPage, pageCount: reviewPageCount } = resolvePage(requestedReviewPage, reviewCount, pageSize);
  const { page: questionPage, pageCount: questionPageCount } = resolvePage(
    requestedQuestionPage,
    product._count.questions,
    pageSize,
  );
  // A page past the end (old link, hand-edited URL) shows the last page instead of an empty list.
  const [productReviews, questions] = await Promise.all([
    reviewPage === requestedReviewPage
      ? product.productReviews
      : db.productReview.findMany({ ...productReviewsArgs(interactionArgs, reviewPage), where: reviewWhere }),
    questionPage === requestedQuestionPage
      ? product.questions
      : db.productQuestion.findMany({
          ...productQuestionsArgs(interactionArgs, questionPage),
          where: { productId: product.id, hiddenAt: null },
        }),
  ]);

  return {
    ...product,
    productReviews,
    questions,
    productReviewAverage: reviewSummary._avg.ratingTenths === null ? null : reviewSummary._avg.ratingTenths / 10,
    productReviewCount: reviewCount,
    reviewDistribution: buildRatingDistribution(
      reviewGroups.map((group) => ({ ratingTenths: group.ratingTenths, count: group._count._all })),
    ),
    unitsSold,
    questionCount: product._count.questions,
    reviewPage,
    reviewPageCount,
    questionPage,
    questionPageCount,
  };
}

function parseReviewRating(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) return undefined;
  return value;
}

function approvedProductWhere(slug: string) {
  return {
    slug,
    status: ProductStatus.APPROVED,
    category: { active: true },
    brand: { active: true },
    seller: { status: { in: ["APPROVED", "ACTIVE"] } },
  } satisfies Prisma.ProductWhereInput;
}

function productReviewWhere(productId: string, reviewRating: number | undefined): Prisma.ProductReviewWhereInput {
  return {
    productId,
    hiddenAt: null,
    ...(reviewRating ? { ratingTenths: { gte: reviewRating * 10 } } : {}),
  };
}

function productReviewsArgs(args: ProductInteractionArgs, page: number) {
  return {
    where: { hiddenAt: null, ...(args.reviewRating ? { ratingTenths: { gte: args.reviewRating * 10 } } : {}) },
    include: { user: { select: { name: true } }, media: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: args.reviewSort === "oldest" ? "asc" : "desc" },
    skip: (page - 1) * args.pageSize,
    take: args.pageSize,
  } satisfies Prisma.Product$productReviewsArgs;
}

function productQuestionsArgs(args: ProductInteractionArgs, page: number) {
  return {
    where: { hiddenAt: null },
    include: {
      askedBy: { select: { name: true } },
      answeredBy: { select: { name: true } },
    },
    orderBy: { createdAt: args.questionSort === "oldest" ? "asc" : "desc" },
    skip: (page - 1) * args.pageSize,
    take: args.pageSize,
  } satisfies Prisma.Product$questionsArgs;
}

function approvedProductDetailInclude(
  args: ProductInteractionArgs,
  reviewPage: number,
  questionPage: number,
  now: Date,
) {
  return {
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
    productReviews: productReviewsArgs(args, reviewPage),
    questions: productQuestionsArgs(args, questionPage),
    _count: { select: { productReviews: { where: { hiddenAt: null } }, questions: { where: { hiddenAt: null } } } },
  } satisfies Prisma.ProductInclude;
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
