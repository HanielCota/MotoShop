import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { db } from "@/lib/database";
import { ImageKitStorageProvider } from "@/lib/storage/imagekit-storage-provider";
import { ApplicationError } from "@/shared/errors/application-error";

import { reviewEligibleOrderItemWhere } from "../actions/review-eligibility";
import { reviewMediaTypes, type ReviewInput, type UploadedReviewMedia } from "../schemas/review";

const MAX_TOTAL_MEDIA_BYTES = 20 * 1024 * 1024;

type ReviewMediaRecord = {
  mediaType: "image" | "video";
  contentType: string;
  sizeInBytes: number;
  storageKey: string;
  sortOrder: number;
};

type ReviewedOrderItem = {
  id: string;
  sellerId: string;
  orderId: string;
  productId: string;
};

export type CreatedReview = { productSlug: string; orderNumber: string };

/** Publishes a product review (and the seller review, once per order) for an eligible purchase. */
export async function createReview(userId: string, input: ReviewInput): Promise<CreatedReview> {
  const orderItem = await findReviewableOrderItem(userId, input.orderItemId);
  const product = orderItem.product;
  if (!product) throw reviewableItemNotFound();

  const media = await verifyReviewMedia(userId, orderItem.id, input.media);
  const reviewedItem = {
    id: orderItem.id,
    sellerId: orderItem.sellerId,
    orderId: orderItem.sellerOrder.orderId,
    productId: product.id,
  };

  await db.$transaction(async (tx) => persistReview(tx, { userId, input, orderItem: reviewedItem, media }));

  return { productSlug: product.slug, orderNumber: orderItem.sellerOrder.order.orderNumber };
}

async function findReviewableOrderItem(userId: string, orderItemId: string) {
  const orderItem = await db.orderItem.findFirst({
    where: reviewEligibleOrderItemWhere(orderItemId, userId),
    include: {
      sellerOrder: { include: { order: { select: { orderNumber: true } } } },
      product: true,
    },
  });
  if (!orderItem) throw reviewableItemNotFound();

  return orderItem;
}

function reviewableItemNotFound(): ApplicationError {
  return new ApplicationError({ code: "NOT_FOUND", message: "Compra elegível para avaliação não encontrada." });
}

async function verifyReviewMedia(
  userId: string,
  orderItemId: string,
  uploads: readonly UploadedReviewMedia[],
): Promise<ReviewMediaRecord[]> {
  const expectedPrefix = `reviews/${userId}/${orderItemId}/`;
  const media: ReviewMediaRecord[] = [];
  const uniqueKeys = new Set<string>();
  let totalMediaBytes = 0;

  for (const upload of uploads) {
    assertUploadBelongsToPurchase(upload, expectedPrefix, uniqueKeys);
    uniqueKeys.add(upload.key);
    const verified = await verifyUploadedAsset(upload);
    totalMediaBytes += verified.sizeInBytes;
    assertTotalMediaSize(totalMediaBytes);
    media.push({ ...verified, storageKey: upload.key, sortOrder: media.length });
  }

  return media;
}

function assertUploadBelongsToPurchase(
  upload: UploadedReviewMedia,
  expectedPrefix: string,
  uniqueKeys: ReadonlySet<string>,
): void {
  const extension = reviewMediaTypes[upload.contentType].extension;
  const hasExpectedName = new RegExp(`^[a-f0-9-]+\\.${extension}$`, "i").test(upload.key.slice(expectedPrefix.length));
  if (upload.key.startsWith(expectedPrefix) && hasExpectedName && !uniqueKeys.has(upload.key)) return;

  throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Um dos arquivos não pertence a esta compra." });
}

async function verifyUploadedAsset(upload: UploadedReviewMedia) {
  return new ImageKitStorageProvider().verifyAsset({
    key: upload.key,
    fileId: upload.fileId,
    maxSizeInBytes: reviewMediaTypes[upload.contentType].maxSizeInBytes,
    contentTypes: [upload.contentType],
  });
}

function assertTotalMediaSize(totalMediaBytes: number): void {
  if (totalMediaBytes <= MAX_TOTAL_MEDIA_BYTES) return;

  throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Os anexos juntos devem ter no máximo 20 MB." });
}

async function persistReview(
  tx: Prisma.TransactionClient,
  review: { userId: string; input: ReviewInput; orderItem: ReviewedOrderItem; media: ReviewMediaRecord[] },
): Promise<void> {
  const { userId, input, orderItem, media } = review;
  await assertStillEligible(tx, userId, orderItem.id);

  const hasSellerReview = await hasExistingSellerReview(tx, userId, orderItem);
  if (!hasSellerReview && input.sellerRating === undefined) {
    throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Informe também a nota para o lojista." });
  }

  await createProductReview(tx, { userId, input, orderItem, media });
  if (hasSellerReview || input.sellerRating === undefined) return;

  await createSellerReview(tx, { userId, rating: input.sellerRating, comment: input.comment, orderItem });
}

async function assertStillEligible(tx: Prisma.TransactionClient, userId: string, orderItemId: string): Promise<void> {
  const eligibleItem = await tx.orderItem.findFirst({
    where: reviewEligibleOrderItemWhere(orderItemId, userId),
    select: { id: true },
  });
  if (eligibleItem) return;

  throw new ApplicationError({ code: "CONFLICT", message: "Esta compra não está mais elegível para avaliação." });
}

async function hasExistingSellerReview(
  tx: Prisma.TransactionClient,
  userId: string,
  orderItem: ReviewedOrderItem,
): Promise<boolean> {
  const existingSellerReview = await tx.sellerReview.findUnique({
    where: {
      orderId_sellerId_userId: { orderId: orderItem.orderId, sellerId: orderItem.sellerId, userId },
    },
  });
  return existingSellerReview !== null;
}

async function createProductReview(
  tx: Prisma.TransactionClient,
  review: { userId: string; input: ReviewInput; orderItem: ReviewedOrderItem; media: ReviewMediaRecord[] },
): Promise<void> {
  const { userId, input, orderItem, media } = review;
  await tx.productReview.create({
    data: {
      ratingTenths: input.productRatingTenths,
      ...(input.comment ? { comment: input.comment } : {}),
      productId: orderItem.productId,
      sellerId: orderItem.sellerId,
      orderId: orderItem.orderId,
      orderItemId: orderItem.id,
      userId,
      ...(media.length > 0 ? { media: { create: media } } : {}),
    },
  });
}

async function createSellerReview(
  tx: Prisma.TransactionClient,
  review: { userId: string; rating: number; comment: string | undefined; orderItem: ReviewedOrderItem },
): Promise<void> {
  const { userId, rating, comment, orderItem } = review;
  await tx.sellerReview.create({
    data: {
      rating,
      ...(comment ? { comment } : {}),
      sellerId: orderItem.sellerId,
      orderId: orderItem.orderId,
      userId,
    },
  });
}
