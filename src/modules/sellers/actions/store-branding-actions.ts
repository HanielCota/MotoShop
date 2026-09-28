"use server";

import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/database";
import { ImageKitStorageProvider } from "@/lib/storage/imagekit-storage-provider";
import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { asApplicationError } from "@/shared/errors/application-error";
import { getPublicStorageUrl } from "@/shared/storage/public-storage-url";

const maxImageSizeInBytes = 5 * 1024 * 1024;
const allowedContentTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

const imageTypeSchema = z.enum(["logo", "banner"]);
const uploadInputSchema = z.object({
  imageType: imageTypeSchema,
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeInBytes: z.number().int().positive().max(maxImageSizeInBytes),
});
const attachInputSchema = z.object({
  imageType: imageTypeSchema,
  storageKey: z.string().min(1).max(300),
  fileId: z.string().regex(/^[a-f0-9]{24}$/i),
});

export type StoreBrandingImageType = z.infer<typeof imageTypeSchema>;
export type StoreBrandingUploadResult =
  | { error: string; url?: never; key?: never; expiresAt?: never; fields?: never }
  | { error?: never; url: string; key: string; expiresAt: string; fields: Record<string, string> };
export type StoreBrandingResult =
  | { error: string; image?: never }
  | { error?: never; image: { imageType: StoreBrandingImageType; storageKey: string; url: string | null } };

function fieldForImageType(imageType: StoreBrandingImageType) {
  return imageType === "logo" ? "logoStorageKey" : "bannerStorageKey";
}

function hasValidStoreImageKey(storageKey: string, sellerId: string, imageType: StoreBrandingImageType) {
  const prefix = `stores/${sellerId}/${imageType}/`;
  return storageKey.startsWith(prefix) && /^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(storageKey.slice(prefix.length));
}

async function revalidateStorePaths(slug: string) {
  revalidatePath("/seller");
  revalidatePath(`/loja/${slug}`);
  revalidatePath("/sitemap.xml");
}

export async function createStoreBrandingUploadUrlAction(input: unknown): Promise<StoreBrandingUploadResult> {
  try {
    const context = await requireSellerAccess("SELLER_MANAGE");
    const parsed = uploadInputSchema.parse(input);
    const extension = allowedContentTypes[parsed.contentType];
    const key = `stores/${context.seller.id}/${parsed.imageType}/${randomUUID()}.${extension}`;
    const result = await new ImageKitStorageProvider().createUploadUrl({ key, contentType: parsed.contentType });
    return { url: result.url, key: result.key, expiresAt: result.expiresAt.toISOString(), fields: result.fields };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function attachStoreBrandingImageAction(input: unknown): Promise<StoreBrandingResult> {
  try {
    const context = await requireSellerAccess("SELLER_MANAGE");
    const parsed = attachInputSchema.parse(input);
    if (!hasValidStoreImageKey(parsed.storageKey, context.seller.id, parsed.imageType)) {
      return { error: "A imagem não pertence a esta loja." };
    }
    await new ImageKitStorageProvider().verifyImage({
      key: parsed.storageKey,
      fileId: parsed.fileId,
      maxSizeInBytes: maxImageSizeInBytes,
      contentTypes: Object.keys(allowedContentTypes),
    });

    const field = fieldForImageType(parsed.imageType);
    const previousStore = await db.store.findFirst({
      where: { id: context.store.id, sellerId: context.seller.id },
      select: { id: true, slug: true, logoStorageKey: true, bannerStorageKey: true },
    });
    if (!previousStore) return { error: "Loja não encontrada." };

    const updatedStore = await db.store.update({
      where: { id: previousStore.id },
      data: { [field]: parsed.storageKey },
      select: { id: true, slug: true, logoStorageKey: true, bannerStorageKey: true },
    });

    await db.auditLog.create({
      data: {
        action: "STORE_BRANDING_UPDATED",
        entityType: "STORE",
        entityId: updatedStore.id,
        actorUserId: context.session.user.id,
        metadata: {
          sellerId: context.seller.id,
          imageType: parsed.imageType,
          previousStorageKey: previousStore[field],
          currentStorageKey: updatedStore[field],
        } as Prisma.InputJsonValue,
      },
    });

    await revalidateStorePaths(updatedStore.slug);
    return {
      image: {
        imageType: parsed.imageType,
        storageKey: parsed.storageKey,
        url: getPublicStorageUrl(parsed.storageKey),
      },
    };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}
