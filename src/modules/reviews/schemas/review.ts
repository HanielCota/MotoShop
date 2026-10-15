import { z } from "zod";

export const reviewMediaTypes = {
  "image/jpeg": { extension: "jpg", mediaType: "image" as const, maxSizeInBytes: 5 * 1024 * 1024 },
  "image/png": { extension: "png", mediaType: "image" as const, maxSizeInBytes: 5 * 1024 * 1024 },
  "image/webp": { extension: "webp", mediaType: "image" as const, maxSizeInBytes: 5 * 1024 * 1024 },
  "video/mp4": { extension: "mp4", mediaType: "video" as const, maxSizeInBytes: 10 * 1024 * 1024 },
  "video/webm": { extension: "webm", mediaType: "video" as const, maxSizeInBytes: 10 * 1024 * 1024 },
  "video/quicktime": { extension: "mov", mediaType: "video" as const, maxSizeInBytes: 10 * 1024 * 1024 },
} as const;

type ReviewMediaContentType = keyof typeof reviewMediaTypes;

export const uploadedReviewMediaSchema = z.object({
  key: z.string().min(1).max(300),
  fileId: z.string().regex(/^[a-f0-9]{24}$/i),
  contentType: z.enum(Object.keys(reviewMediaTypes) as [ReviewMediaContentType, ...ReviewMediaContentType[]]),
});

export const reviewSchema = z.object({
  orderItemId: z.cuid(),
  productRatingTenths: z.coerce.number().int().min(1).max(50),
  sellerRating: z.coerce.number().int().min(1).max(5).optional(),
  comment: z.string().trim().max(1000).optional(),
  media: z.array(uploadedReviewMediaSchema).max(3),
});

export type ReviewInput = z.infer<typeof reviewSchema>;

export type UploadedReviewMedia = z.infer<typeof uploadedReviewMediaSchema>;

/** Reads the review form; a malformed media payload becomes `null` so the schema rejects it. */
export function readReviewFormInput(formData: FormData) {
  return {
    orderItemId: formData.get("orderItemId"),
    productRatingTenths: formData.get("productRatingTenths"),
    sellerRating: formData.get("sellerRating") || undefined,
    comment: formData.get("comment") || undefined,
    media: readMediaField(formData.get("media")),
  };
}

function readMediaField(raw: FormDataEntryValue | null): unknown[] | null {
  if (typeof raw !== "string") return [];

  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}
