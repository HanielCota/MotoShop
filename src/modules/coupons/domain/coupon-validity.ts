import { parseDateFilter } from "@/lib/date-filter";

export type CouponValidityBound = "start" | "end";

const BRASILIA_OFFSET_IN_MS = 3 * 60 * 60 * 1000;

/**
 * Turns the day typed in the coupon form (dd/mm/aaaa, Brasília time, UTC−03:00) into the instant
 * persisted in UTC: the start is valid from 00:00 and the end until 23:59:59.999 of that day.
 * Blank means an open bound (`undefined`); text that is not a date becomes an invalid Date, which
 * the schema rejects.
 */
export function parseCouponValidityDate(value: FormDataEntryValue | null, bound: CouponValidityBound) {
  if (typeof value !== "string" || value.trim() === "") return undefined;

  const day = parseDateFilter(value, bound === "end");
  if (!day) return new Date(Number.NaN);

  const endAdjustment = bound === "end" ? -1 : 0;
  return new Date(day.getTime() + BRASILIA_OFFSET_IN_MS + endAdjustment);
}

/** The end may not come before the start nor be already over: that coupon would never apply. */
export function findCouponValidityError(
  validity: { startsAt?: Date | undefined; endsAt?: Date | undefined },
  now: Date,
): string | null {
  const { startsAt, endsAt } = validity;
  if (!endsAt) return null;
  if (startsAt && endsAt < startsAt) return "O fim da validade não pode ser antes do início.";
  if (endsAt < now) return "O fim da validade já passou. Escolha hoje ou uma data futura.";
  return null;
}
