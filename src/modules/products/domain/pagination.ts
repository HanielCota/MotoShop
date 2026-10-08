/**
 * Upper bound for page numbers read from the URL. `?page=99999999999999999999` parses to 1e20,
 * and `skip = (page - 1) * pageSize` would overflow the 64-bit offset Prisma accepts.
 */
export const MAX_REQUESTED_PAGE = 100_000;

/** Normalizes a page number coming from the URL to `1..MAX_REQUESTED_PAGE`. */
export function normalizeRequestedPage(page: number | null | undefined) {
  if (typeof page !== "number" || !Number.isFinite(page)) return 1;
  return Math.min(Math.max(Math.trunc(page), 1), MAX_REQUESTED_PAGE);
}

/** Clamps the requested page to the pages that exist for `total` items. */
export function resolvePage(page: number | null | undefined, total: number, pageSize: number) {
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  const resolved = Math.min(normalizeRequestedPage(page), pageCount);
  return { page: resolved, pageCount, skip: (resolved - 1) * pageSize };
}
