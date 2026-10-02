"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

import { db } from "@/lib/database";
import { logger } from "@/lib/logger";
import { ImageKitStorageProvider } from "@/lib/storage/imagekit-storage-provider";
import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { getPublicStorageUrl } from "@/shared/storage/public-storage-url";
import { asApplicationError, ApplicationError } from "@/shared/errors/application-error";

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
  fileId: z.string().regex(/^[a-f0-9]{24}$/i),
  altText: z.string().trim().max(160).optional(),
});
const reorderInputSchema = z.object({
  productId: z.string().cuid(),
  imageIds: z.array(z.string().cuid()).min(1).max(8),
});
const removeInputSchema = z.object({ imageId: z.string().cuid() });

export type ProductImageActionState = { error?: string; success?: string };
export type ProductImageUploadResult =
  | { error: string; url?: never; key?: never; expiresAt?: never; fields?: never }
  | { error?: never; url: string; key: string; expiresAt: string; fields: Record<string, string> };
export type ProductImageResult =
  | { error: string; image?: never }
  | { error?: never; image: { id: string; storageKey: string; altText: string | null; url: string | null } };

async function getEditableProduct(
  productId: string,
  sellerId: string,
  client: Pick<Prisma.TransactionClient, "product"> = db,
) {
  const product = await client.product.findFirst({
    where: { id: productId, sellerId, status: { in: ["DRAFT", "REJECTED"] } },
    select: { id: true, sellerId: true },
  });
  if (!product)
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Produto não encontrado ou não está disponível para edição.",
    });
  return product;
}

export async function createProductImageUploadUrlAction(input: unknown): Promise<ProductImageUploadResult> {
  const context = await requireSellerAccess("PRODUCT_UPDATE");
  try {
    const parsed = uploadInputSchema.parse(input);
    await getEditableProduct(parsed.productId, context.seller.id);

    const imageCount = await db.productImage.count({ where: { productId: parsed.productId } });
    if (imageCount >= 8) return { error: "O produto pode ter no máximo 8 imagens." };

    const extension = allowedContentTypes[parsed.contentType];
    const key = `products/${context.seller.id}/${parsed.productId}/${randomUUID()}.${extension}`;
    const result = await new ImageKitStorageProvider().createUploadUrl({
      key,
      contentType: parsed.contentType,
      maxSizeInBytes: maxImageSizeInBytes,
    });
    return { url: result.url, key: result.key, expiresAt: result.expiresAt.toISOString(), fields: result.fields };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function attachProductImageAction(input: unknown): Promise<ProductImageResult> {
  const context = await requireSellerAccess("PRODUCT_UPDATE");
  try {
    const parsed = attachInputSchema.parse(input);
    await getEditableProduct(parsed.productId, context.seller.id);

    const prefix = `products/${context.seller.id}/${parsed.productId}/`;
    if (
      !parsed.storageKey.startsWith(prefix) ||
      !/^[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(parsed.storageKey.slice(prefix.length))
    )
      return { error: "A imagem não pertence a este produto." };
    await new ImageKitStorageProvider().verifyImage({
      key: parsed.storageKey,
      fileId: parsed.fileId,
      maxSizeInBytes: maxImageSizeInBytes,
      contentTypes: Object.keys(allowedContentTypes),
    });

    const image = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "products" WHERE id = ${parsed.productId} FOR UPDATE`;
      await getEditableProduct(parsed.productId, context.seller.id, tx);
      const existing = await tx.productImage.findFirst({
        where: { productId: parsed.productId, storageKey: parsed.storageKey },
      });
      if (existing) return existing;
      const imageCount = await tx.productImage.count({ where: { productId: parsed.productId } });
      if (imageCount >= 8)
        throw new ApplicationError({ code: "CONFLICT", message: "O produto pode ter no máximo 8 imagens." });
      return tx.productImage.create({
        data: {
          storageKey: parsed.storageKey,
          altText: parsed.altText || null,
          productId: parsed.productId,
          sortOrder: imageCount,
        },
      });
    });
    revalidatePath(`/seller/products/${parsed.productId}/edit`);
    revalidatePath("/products");
    return { image: { ...image, url: getPublicStorageUrl(image.storageKey) } };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function reorderProductImagesAction(input: unknown): Promise<ProductImageActionState> {
  const context = await requireSellerAccess("PRODUCT_UPDATE");
  try {
    const parsed = reorderInputSchema.parse(input);
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "products" WHERE id = ${parsed.productId} FOR UPDATE`;
      await getEditableProduct(parsed.productId, context.seller.id, tx);

      const images = await tx.productImage.findMany({
        where: { productId: parsed.productId },
        select: { id: true },
      });
      const currentIds = new Set(images.map((image) => image.id));
      const hasSameImages =
        images.length === parsed.imageIds.length && parsed.imageIds.every((id) => currentIds.has(id));
      if (!hasSameImages || new Set(parsed.imageIds).size !== parsed.imageIds.length) {
        throw new ApplicationError({
          code: "CONFLICT",
          message: "A galeria mudou. Atualize a página e tente novamente.",
        });
      }

      await Promise.all(
        parsed.imageIds.map((id, sortOrder) => tx.productImage.update({ where: { id }, data: { sortOrder } })),
      );
    });
    revalidateProductImagePaths(parsed.productId);
    return { success: "Ordem das imagens atualizada." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function removeProductImageAction(input: unknown): Promise<ProductImageActionState> {
  const context = await requireSellerAccess("PRODUCT_UPDATE");
  try {
    const parsed = removeInputSchema.parse(input);
    const image = await db.productImage.findFirst({
      where: {
        id: parsed.imageId,
        product: { sellerId: context.seller.id, status: { in: ["DRAFT", "REJECTED"] } },
      },
      select: { id: true, productId: true, storageKey: true, product: { select: { slug: true } } },
    });
    if (!image) return { error: "Imagem não encontrada ou não disponível para remoção." };

    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "products" WHERE id = ${image.productId} FOR UPDATE`;
      await getEditableProduct(image.productId, context.seller.id, tx);
      await tx.productImage.deleteMany({ where: { id: image.id, productId: image.productId } });
    });
    try {
      await new ImageKitStorageProvider().deleteObject({ key: image.storageKey });
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
