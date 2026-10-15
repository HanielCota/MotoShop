import { z } from "zod";

export const reviewMediaTypes = {
  "image/jpeg": { extension: "jpg", mediaType: "image" as const, maxSizeInBytes: 5 * 1024 * 1024 },
  "image/png": { extension: "png", mediaType: "image" as const, maxSizeInBytes: 5 * 1024 * 1024 },
  "image/webp": { extension: "webp", mediaType: "image" as const, maxSizeInBytes: 5 * 1024 * 1024 },
} as const;
// Client decision (08/10/2026): videos are out of scope in reviews. Old video media still render.

type ReviewMediaContentType = keyof typeof reviewMediaTypes;

export const uploadedReviewMediaSchema = z.object({
  key: z.string().min(1).max(300),
  fileId: z.string().regex(/^[a-f0-9]{24}$/i),
  contentType: z.enum(Object.keys(reviewMediaTypes) as [ReviewMediaContentType, ...ReviewMediaContentType[]]),
});

export const reviewSchema = z.object({
  orderItemId: z.cuid(),
  // Whole stars only (10, 20…50 tenths): the decimal belongs to the average, never to one review.
  productRatingTenths: z.coerce
    .number()
    .int()
    .min(10)
    .max(50)
    .refine((tenths) => tenths % 10 === 0, "Escolha uma nota de 1 a 5 estrelas."),
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
