import { z } from "zod";

/** Regras das fotos da devolução: até 3 imagens privadas por solicitação. */
export const MAX_RETURN_PHOTOS = 3;
export const MAX_RETURN_PHOTO_SIZE_IN_BYTES = 5 * 1024 * 1024;
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

/** Foto já enviada ao ImageKit, ainda sem conferência: o servidor confere antes de gravar. */
export const uploadedReturnPhotosSchema = z
  .array(z.object({ key: z.string().min(1).max(300), fileId: z.string().min(1).max(100) }))
  .max(MAX_RETURN_PHOTOS, `Anexe no máximo ${MAX_RETURN_PHOTOS} fotos.`);

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
