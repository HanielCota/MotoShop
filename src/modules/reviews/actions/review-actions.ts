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

import { createReview } from "../application/create-review";
import { readReviewFormInput, reviewMediaTypes, reviewSchema, uploadedReviewMediaSchema } from "../schemas/review";
import { reviewEligibleOrderItemWhere } from "./review-eligibility";

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
      contentType: uploadedReviewMediaSchema.shape.contentType,
      sizeInBytes: z.number().int().positive(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Arquivo inválido ou não suportado." };

  try {
    await assertRateLimit({ key: `review-upload:${session.user.id}`, windowSeconds: 60, max: 5 });
    const item = await db.orderItem.findFirst({
      where: { ...reviewEligibleOrderItemWhere(parsed.data.orderItemId, session.user.id), productReview: null },
      select: { id: true },
    });
    if (!item)
      throw new ApplicationError({ code: "NOT_FOUND", message: "Compra elegível para avaliação não encontrada." });

    const mediaConfig = reviewMediaTypes[parsed.data.contentType];
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
  const parsed = reviewSchema.safeParse(readReviewFormInput(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira sua avaliação." };

  try {
    await assertRateLimit({ key: `review:${session.user.id}`, windowSeconds: 60, max: 5 });
    const review = await createReview(session.user.id, parsed.data);

    revalidatePath(`/products/${review.productSlug}`);
    revalidatePath(`/orders/${review.orderNumber}`);
    return { success: "Avaliação publicada. Obrigado pelo feedback." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Este item já foi avaliado." };
    }
    return { error: asApplicationError(error).message };
  }
}
