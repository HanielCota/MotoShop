"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/database";
import { ImageKitStorageProvider } from "@/lib/storage/imagekit-storage-provider";
import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { asApplicationError } from "@/shared/errors/application-error";
import { assertRateLimit } from "@/shared/rate-limit/consume-rate-limit";
import {
  attachVerifiedAsset,
  createImageUploadUrl,
  GENERATED_IMAGE_NAME,
  IMAGE_MAX_SIZE_IN_BYTES,
  isStorageKeyUnderPrefix,
} from "@/shared/storage/attach-verified-asset";
import { getPublicStorageUrl } from "@/shared/storage/public-storage-url";

const imageTypeSchema = z.enum(["logo", "banner"]);
const uploadInputSchema = z.object({
  imageType: imageTypeSchema,
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeInBytes: z.number().int().positive().max(IMAGE_MAX_SIZE_IN_BYTES),
});
const attachInputSchema = z.object({
  imageType: imageTypeSchema,
  storageKey: z.string().min(1).max(300),
  fileId: z.string().regex(/^[a-f0-9]{24}$/i),
});
const discardInputSchema = z.object({ imageType: imageTypeSchema, storageKey: z.string().min(1).max(300) });

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

function storeImagePrefix(sellerId: string, imageType: StoreBrandingImageType) {
  return `stores/${sellerId}/${imageType}/`;
}

function hasValidStoreImageKey(storageKey: string, sellerId: string, imageType: StoreBrandingImageType) {
  return isStorageKeyUnderPrefix(storageKey, storeImagePrefix(sellerId, imageType), GENERATED_IMAGE_NAME);
}

async function revalidateStorePaths(slug: string) {
  revalidatePath("/seller", "layout");
  revalidatePath(`/loja/${slug}`);
  revalidatePath("/sitemap.xml");
}

export async function createStoreBrandingUploadUrlAction(input: unknown): Promise<StoreBrandingUploadResult> {
  try {
    const context = await requireSellerAccess("SELLER_MANAGE");
    const parsed = uploadInputSchema.parse(input);
    await assertRateLimit({ key: `store-branding-upload:${context.seller.id}`, windowSeconds: 60, max: 10 });
    return await createImageUploadUrl({
      prefix: storeImagePrefix(context.seller.id, parsed.imageType),
      contentType: parsed.contentType,
    });
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function discardStoreBrandingUploadAction(input: unknown): Promise<{ error?: string }> {
  try {
    const context = await requireSellerAccess("SELLER_MANAGE");
    const parsed = discardInputSchema.parse(input);
    if (!hasValidStoreImageKey(parsed.storageKey, context.seller.id, parsed.imageType)) {
      return { error: "A imagem não pertence a esta loja." };
    }

    const store =
      parsed.imageType === "logo"
        ? await db.store.findFirst({
            where: { id: context.store.id, sellerId: context.seller.id },
            select: { logoStorageKey: true },
          })
        : await db.store.findFirst({
            where: { id: context.store.id, sellerId: context.seller.id },
            select: { bannerStorageKey: true },
          });
    if (!store) return { error: "Loja não encontrada." };
    const currentKey = "logoStorageKey" in store ? store.logoStorageKey : store.bannerStorageKey;
    if (currentKey !== parsed.storageKey) {
      await new ImageKitStorageProvider().deleteObject({ key: parsed.storageKey });
    }
    return {};
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function attachStoreBrandingImageAction(input: unknown): Promise<StoreBrandingResult> {
  try {
    const context = await requireSellerAccess("SELLER_MANAGE");
    const parsed = attachInputSchema.parse(input);
    const field = fieldForImageType(parsed.imageType);
    const attached = await attachVerifiedAsset({
      storageKey: parsed.storageKey,
      fileId: parsed.fileId,
      prefix: storeImagePrefix(context.seller.id, parsed.imageType),
      namePattern: GENERATED_IMAGE_NAME,
      persist: () =>
        db.$transaction(async (tx) => {
          const previousStore = await tx.store.findFirst({
            where: { id: context.store.id, sellerId: context.seller.id },
            select: { id: true, slug: true, logoStorageKey: true, bannerStorageKey: true },
          });
          if (!previousStore) return null;

          const store = await tx.store.update({
            where: { id: previousStore.id },
            data: { [field]: parsed.storageKey },
            select: { id: true, slug: true, logoStorageKey: true, bannerStorageKey: true },
          });

          await tx.auditLog.create({
            data: {
              action: "STORE_BRANDING_UPDATED",
              entityType: "STORE",
              entityId: store.id,
              actorUserId: context.session.user.id,
              metadata: {
                sellerId: context.seller.id,
                imageType: parsed.imageType,
                previousStorageKey: previousStore[field],
                currentStorageKey: store[field],
              } as Prisma.InputJsonValue,
            },
          });
          return store;
        }),
    });
    if (!attached.ok) return { error: "A imagem não pertence a esta loja." };
    const updatedStore = attached.value;
    if (!updatedStore) return { error: "Loja não encontrada." };

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
