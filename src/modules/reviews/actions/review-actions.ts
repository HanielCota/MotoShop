"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

import { db } from "@/lib/database";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { asApplicationError, ApplicationError } from "@/shared/errors/application-error";
import { assertRateLimit } from "@/shared/rate-limit/consume-rate-limit";
import { ImageKitStorageProvider } from "@/lib/storage/imagekit-storage-provider";

const mediaTypes = {
  "image/jpeg": { extension: "jpg", mediaType: "image" as const, maxSizeInBytes: 5 * 1024 * 1024 },
  "image/png": { extension: "png", mediaType: "image" as const, maxSizeInBytes: 5 * 1024 * 1024 },
  "image/webp": { extension: "webp", mediaType: "image" as const, maxSizeInBytes: 5 * 1024 * 1024 },
  "video/mp4": { extension: "mp4", mediaType: "video" as const, maxSizeInBytes: 10 * 1024 * 1024 },
  "video/webm": { extension: "webm", mediaType: "video" as const, maxSizeInBytes: 10 * 1024 * 1024 },
  "video/quicktime": { extension: "mov", mediaType: "video" as const, maxSizeInBytes: 10 * 1024 * 1024 },
} as const;

const uploadedMediaSchema = z.object({
  key: z.string().min(1).max(300),
  fileId: z.string().regex(/^[a-f0-9]{24}$/i),
  contentType: z.enum(Object.keys(mediaTypes) as [keyof typeof mediaTypes, ...(keyof typeof mediaTypes)[]]),
});

const reviewSchema = z.object({
  orderItemId: z.cuid(),
  productRatingTenths: z.coerce.number().int().min(1).max(50),
  sellerRating: z.coerce.number().int().min(1).max(5).optional(),
  comment: z.string().trim().max(1000).optional(),
  media: z.array(uploadedMediaSchema).max(3),
});

export type ReviewActionState = { error?: string; success?: string };

export type ReviewUploadResult =
  { error: string } | { url: string; key: string; expiresAt: string; fields: Record<string, string> };

export async function createReviewUploadUrlAction(input: {
  orderItemId: string;
  contentType: string;
  sizeInBytes: number;
}): Promise<ReviewUploadResult> {
  const session = await requireAuthenticatedUser("/orders");
  const parsed = z
    .object({
      orderItemId: z.cuid(),
      contentType: uploadedMediaSchema.shape.contentType,
      sizeInBytes: z.number().int().positive(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Arquivo inválido ou não suportado." };

  try {
    await assertRateLimit({ key: `review-upload:${session.user.id}`, windowSeconds: 60, max: 5 });
    const item = await db.orderItem.findFirst({
      where: {
        id: parsed.data.orderItemId,
        sellerOrder: {
          status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
          order: { userId: session.user.id },
        },
        productReview: null,
      },
      select: { id: true },
    });
    if (!item)
      throw new ApplicationError({ code: "NOT_FOUND", message: "Compra elegível para avaliação não encontrada." });

    const mediaConfig = mediaTypes[parsed.data.contentType];
    if (parsed.data.sizeInBytes > mediaConfig.maxSizeInBytes)
      return { error: `Este arquivo excede o limite de ${mediaConfig.maxSizeInBytes / 1024 / 1024} MB.` };

    const key = `reviews/${session.user.id}/${item.id}/${randomUUID()}.${mediaConfig.extension}`;
    const upload = await new ImageKitStorageProvider().createUploadUrl({
      key,
      contentType: parsed.data.contentType,
      maxSizeInBytes: mediaConfig.maxSizeInBytes,
    });
    return { url: upload.url, key: upload.key, expiresAt: upload.expiresAt.toISOString(), fields: upload.fields };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function removeReviewUploadAction(input: {
  orderItemId: string;
  key: string;
}): Promise<{ error?: string }> {
  const session = await requireAuthenticatedUser("/orders");
  const parsed = z.object({ orderItemId: z.cuid(), key: z.string().min(1).max(300) }).safeParse(input);
  if (!parsed.success) return { error: "Arquivo inválido." };
  try {
    const item = await db.orderItem.findFirst({
      where: {
        id: parsed.data.orderItemId,
        sellerOrder: { order: { userId: session.user.id } },
      },
      select: { id: true },
    });
    const prefix = `reviews/${session.user.id}/${parsed.data.orderItemId}/`;
    if (
      !item ||
      !parsed.data.key.startsWith(prefix) ||
      !/^[a-f0-9-]+\.(jpg|png|webp|mp4|webm|mov)$/i.test(parsed.data.key.slice(prefix.length))
    )
      return { error: "Arquivo não encontrado." };
    const attachedMedia = await db.productReviewMedia.findUnique({ where: { storageKey: parsed.data.key } });
    if (attachedMedia) return { error: "Este arquivo já está associado a uma avaliação." };
    await new ImageKitStorageProvider().deleteObject({ key: parsed.data.key });
    return {};
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function createReviewAction(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const session = await requireAuthenticatedUser("/orders");
  const parsed = reviewSchema.safeParse({
    orderItemId: formData.get("orderItemId"),
    productRatingTenths: formData.get("productRatingTenths"),
    sellerRating: formData.get("sellerRating") || undefined,
    comment: formData.get("comment") || undefined,
    media: (() => {
      const raw = formData.get("media");
      if (typeof raw !== "string") return [];
      try {
        const value: unknown = JSON.parse(raw);
        return Array.isArray(value) ? value : null;
      } catch {
        return null;
      }
    })(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira sua avaliação." };

  try {
    await assertRateLimit({ key: `review:${session.user.id}`, windowSeconds: 60, max: 5 });
    const orderItem = await db.orderItem.findFirst({
      where: {
        id: parsed.data.orderItemId,
        sellerOrder: {
          status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
          order: { userId: session.user.id },
        },
      },
      include: {
        sellerOrder: { include: { order: { select: { orderNumber: true } } } },
        product: true,
      },
    });
    if (!orderItem?.product) {
      throw new ApplicationError({ code: "NOT_FOUND", message: "Compra elegível para avaliação não encontrada." });
    }
    const product = orderItem.product;

    const media: {
      mediaType: "image" | "video";
      contentType: string;
      sizeInBytes: number;
      storageKey: string;
      sortOrder: number;
    }[] = [];
    const uniqueKeys = new Set<string>();
    let totalMediaBytes = 0;
    for (const upload of parsed.data.media) {
      const config = mediaTypes[upload.contentType];
      const expectedPrefix = `reviews/${session.user.id}/${orderItem.id}/`;
      if (
        !upload.key.startsWith(expectedPrefix) ||
        !new RegExp(`^[a-f0-9-]+\\.${config.extension}$`, "i").test(upload.key.slice(expectedPrefix.length)) ||
        uniqueKeys.has(upload.key)
      ) {
        throw new ApplicationError({
          code: "VALIDATION_ERROR",
          message: "Um dos arquivos não pertence a esta compra.",
        });
      }
      uniqueKeys.add(upload.key);
      const verified = await new ImageKitStorageProvider().verifyAsset({
        key: upload.key,
        fileId: upload.fileId,
        maxSizeInBytes: config.maxSizeInBytes,
        contentTypes: [upload.contentType],
      });
      totalMediaBytes += verified.sizeInBytes;
      if (totalMediaBytes > 20 * 1024 * 1024)
        throw new ApplicationError({
          code: "VALIDATION_ERROR",
          message: "Os anexos juntos devem ter no máximo 20 MB.",
        });
      media.push({ ...verified, storageKey: upload.key, sortOrder: media.length });
    }

    await db.$transaction(async (tx) => {
      const eligibleItem = await tx.orderItem.findFirst({
        where: {
          id: orderItem.id,
          sellerOrder: {
            status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
            order: { userId: session.user.id },
          },
        },
        select: { id: true },
      });
      if (!eligibleItem)
        throw new ApplicationError({ code: "CONFLICT", message: "Esta compra não está mais elegível para avaliação." });
      const existingSellerReview = await tx.sellerReview.findUnique({
        where: {
          orderId_sellerId_userId: {
            orderId: orderItem.sellerOrder.orderId,
            sellerId: orderItem.sellerId,
            userId: session.user.id,
          },
        },
      });
      if (!existingSellerReview && parsed.data.sellerRating === undefined) {
        throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Informe também a nota para o seller." });
      }

      await tx.productReview.create({
        data: {
          ratingTenths: parsed.data.productRatingTenths,
          ...(parsed.data.comment ? { comment: parsed.data.comment } : {}),
          productId: product.id,
          sellerId: orderItem.sellerId,
          orderId: orderItem.sellerOrder.orderId,
          orderItemId: orderItem.id,
          userId: session.user.id,
          ...(media.length > 0 ? { media: { create: media } } : {}),
        },
      });
      if (!existingSellerReview && parsed.data.sellerRating !== undefined) {
        await tx.sellerReview.create({
          data: {
            rating: parsed.data.sellerRating,
            ...(parsed.data.comment ? { comment: parsed.data.comment } : {}),
            sellerId: orderItem.sellerId,
            orderId: orderItem.sellerOrder.orderId,
            userId: session.user.id,
          },
        });
      }
    });
    revalidatePath(`/products/${product.slug}`);
    revalidatePath(`/orders/${orderItem.sellerOrder.order.orderNumber}`);
    return { success: "Avaliação publicada. Obrigado pelo feedback." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Este item já foi avaliado." };
    }
    return { error: asApplicationError(error).message };
  }
}
