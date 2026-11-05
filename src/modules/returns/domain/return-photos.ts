import { z } from "zod";

import { formatCount } from "@/lib/format";
import { MARKETPLACE_LIMIT_BOUNDS } from "@/modules/admin/domain/marketplace-limits";

/** How many private photos one return takes and how big each can be (Admin › Configurações › Limites). */
export type ReturnPhotoRules = { maxPhotos: number; maxSizeInBytes: number };

/** Validade do link assinado que abre a foto privada. */
export const RETURN_PHOTO_LINK_TTL_IN_SECONDS = 10 * 60;
/** Largura da miniatura assinada (tr:w-N), a mesma desenhada na galeria. */
export const RETURN_PHOTO_THUMBNAIL_WIDTH = 160;

export const returnPhotoExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type ReturnPhotoContentType = keyof typeof returnPhotoExtensions;

export const returnPhotoContentTypes = Object.keys(returnPhotoExtensions) as ReturnPhotoContentType[];

export const returnPhotoContentTypeSchema = z.enum(["image/jpeg", "image/png", "image/webp"], {
  error: "Use imagens JPG, PNG ou WebP.",
});

/**
 * Photos already sent to ImageKit, not yet checked: the server checks them before saving. The schema
 * only stops counts no configuration allows; the configured count is checked with the order item.
 */
export const uploadedReturnPhotosSchema = z
  .array(z.object({ key: z.string().min(1).max(300), fileId: z.string().min(1).max(100) }))
  .max(
    MARKETPLACE_LIMIT_BOUNDS.returnPhotoLimit.max,
    `Anexe no máximo ${MARKETPLACE_LIMIT_BOUNDS.returnPhotoLimit.max} fotos.`,
  );

/** Message for a selection or request with more photos than the configured limit. */
export function tooManyReturnPhotosMessage(maxPhotos: number): string {
  return `Anexe no máximo ${formatCount(maxPhotos, "foto", "fotos")}.`;
}

export type UploadedReturnPhoto = z.infer<typeof uploadedReturnPhotosSchema>[number];

/** Pasta das fotos de um item; o caminho só é aceito dentro dela. */
export function returnPhotoFolder(orderItemId: string): string {
  return `returns/${orderItemId}/`;
}

export function buildReturnPhotoKey(
  orderItemId: string,
  fileName: string,
  contentType: ReturnPhotoContentType,
): string {
  return `${returnPhotoFolder(orderItemId)}${fileName}.${returnPhotoExtensions[contentType]}`;
}

export function isReturnPhotoKeyOf(orderItemId: string, key: string): boolean {
  const folder = returnPhotoFolder(orderItemId);
  if (!key.startsWith(folder)) return false;

  return /^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key.slice(folder.length));
}
