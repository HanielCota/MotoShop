import { z } from "zod";

const MAX_VARIANT_ATTRIBUTES = 20;

export const productVariantAttributesSchema = z
  .record(z.string().trim().min(1).max(50), z.string().trim().min(1).max(100))
  .refine((attributes) => Object.keys(attributes).length <= MAX_VARIANT_ATTRIBUTES, {
    message: `A variant can have at most ${MAX_VARIANT_ATTRIBUTES} attributes.`,
  });

export type ProductVariantAttributes = z.infer<typeof productVariantAttributesSchema>;
