"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/database";
import { logger } from "@/lib/logger";
import { R2StorageProvider } from "@/lib/storage/r2-storage-provider";
import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { getPublicStorageUrl } from "@/shared/storage/public-storage-url";
import { asApplicationError } from "@/shared/errors/application-error";

const maxImageSizeInBytes = 5 * 1024 * 1024;
const allowedContentTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

const uploadInputSchema = z.object({
  productId: z.string().cuid(),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeInBytes: z.number().int().positive().max(maxImageSizeInBytes),
});

const attachInputSchema = z.object({
  productId: z.string().cuid(),
  storageKey: z.string().min(1).max(300),
  altText: z.string().trim().max(160).optional(),
});
const reorderInputSchema = z.object({
  productId: z.string().cuid(),
  imageIds: z.array(z.string().cuid()).min(1).max(8),
});
const removeInputSchema = z.object({ imageId: z.string().cuid() });

export type ProductImageActionState = { error?: string; success?: string };
export type ProductImageUploadResult =
  | { error: string; url?: never; key?: never; expiresAt?: never }
  | { error?: never; url: string; key: string; expiresAt: string };
export type ProductImageResult =
  | { error: string; image?: never }
  | { error?: never; image: { id: string; storageKey: string; altText: string | null; url: string | null } };

async function getEditableProduct(productId: string, sellerId: string) {
  const product = await db.product.findFirst({
    where: { id: productId, sellerId, status: { in: ["DRAFT", "REJECTED"] } },
    select: { id: true, sellerId: true },
  });
  if (!product) throw new Error("Produto não encontrado ou não está disponível para edição.");
  return product;
}

export async function createProductImageUploadUrlAction(input: unknown): Promise<ProductImageUploadResult> {
  try {
    const context = await requireSellerAccess("PRODUCT_UPDATE");
    const parsed = uploadInputSchema.parse(input);
    await getEditableProduct(parsed.productId, context.seller.id);

    const imageCount = await db.productImage.count({ where: { productId: parsed.productId } });
    if (imageCount >= 8) return { error: "O produto pode ter no máximo 8 imagens." };

    const extension = allowedContentTypes[parsed.contentType];
    const key = `products/${context.seller.id}/${parsed.productId}/${randomUUID()}.${extension}`;
    const result = await new R2StorageProvider().createUploadUrl({
      key,
      contentType: parsed.contentType,
    });
    return { url: result.url, key: result.key, expiresAt: result.expiresAt.toISOString() };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function attachProductImageAction(input: unknown): Promise<ProductImageResult> {
  try {
    const context = await requireSellerAccess("PRODUCT_UPDATE");
    const parsed = attachInputSchema.parse(input);
    await getEditableProduct(parsed.productId, context.seller.id);

    const prefix = `products/${context.seller.id}/${parsed.productId}/`;
    if (!parsed.storageKey.startsWith(prefix)) return { error: "A imagem não pertence a este produto." };

    const imageCount = await db.productImage.count({ where: { productId: parsed.productId } });
    if (imageCount >= 8) return { error: "O produto pode ter no máximo 8 imagens." };

    const image = await db.productImage.create({
      data: {
        storageKey: parsed.storageKey,
        altText: parsed.altText || null,
        productId: parsed.productId,
        sortOrder: imageCount,
      },
    });
    revalidatePath(`/seller/products/${parsed.productId}/edit`);
    revalidatePath("/products");
    return { image: { ...image, url: getPublicStorageUrl(image.storageKey) } };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function reorderProductImagesAction(input: unknown): Promise<ProductImageActionState> {
  try {
    const context = await requireSellerAccess("PRODUCT_UPDATE");
    const parsed = reorderInputSchema.parse(input);
    await getEditableProduct(parsed.productId, context.seller.id);

    const images = await db.productImage.findMany({
      where: { productId: parsed.productId },
      select: { id: true },
    });
    const currentIds = new Set(images.map((image) => image.id));
    const hasSameImages = images.length === parsed.imageIds.length && parsed.imageIds.every((id) => currentIds.has(id));
    if (!hasSameImages || new Set(parsed.imageIds).size !== parsed.imageIds.length) {
      return { error: "A galeria mudou. Atualize a página e tente novamente." };
    }

    await db.$transaction(
      parsed.imageIds.map((id, sortOrder) => db.productImage.update({ where: { id }, data: { sortOrder } })),
    );
    revalidateProductImagePaths(parsed.productId);
    return { success: "Ordem das imagens atualizada." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function removeProductImageAction(input: unknown): Promise<ProductImageActionState> {
  try {
    const context = await requireSellerAccess("PRODUCT_UPDATE");
    const parsed = removeInputSchema.parse(input);
    const image = await db.productImage.findFirst({
      where: {
        id: parsed.imageId,
        product: { sellerId: context.seller.id, status: { in: ["DRAFT", "REJECTED"] } },
      },
      select: { id: true, productId: true, storageKey: true, product: { select: { slug: true } } },
    });
    if (!image) return { error: "Imagem não encontrada ou não disponível para remoção." };

    await db.productImage.delete({ where: { id: image.id } });
    try {
      await new R2StorageProvider().deleteObject({ key: image.storageKey });
    } catch (storageError) {
      logger.warn(
        {
          event: "product_image.storage_delete_failed",
          productId: image.productId,
          storageKey: image.storageKey,
          error: storageError,
        },
        "Product image was detached but could not be removed from storage",
      );
    }

    revalidateProductImagePaths(image.productId, image.product.slug);
    return { success: "Imagem removida." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

function revalidateProductImagePaths(productId: string, productSlug?: string) {
  revalidatePath(`/seller/products/${productId}/edit`);
  revalidatePath("/products");
  if (productSlug) revalidatePath(`/products/${productSlug}`);
}
