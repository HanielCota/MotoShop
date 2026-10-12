import { z } from "zod";

/** What Next.js hands to a page: any key, repeated keys become arrays. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * One query parameter read at the page edge. Repeated keys keep the first value, and a missing or
 * invalid value becomes `fallback` instead of throwing: a tampered URL renders the default page.
 */
export function searchParam<Output>(schema: z.ZodType<Output>, fallback: Output) {
  return z.preprocess(firstValue, schema).catch(fallback);
}

/** Optional text parameter: trimmed, empty becomes `undefined`, longer than `maxLength` is ignored. */
export function optionalTextSearchParam(maxLength: number) {
  return searchParam(z.string().trim().min(1).max(maxLength).optional(), undefined);
}

/** Parses the raw search params with a shape whose fields never fail (see `searchParam`). */
export function parseSearchParams<Shape extends z.ZodRawShape>(
  shape: Shape,
  raw: RawSearchParams,
): z.infer<z.ZodObject<Shape>> {
  return z.object(shape).parse(raw);
}
