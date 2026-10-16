type DateParts = { day: number; month: number; year: number };

/**
 * Day, month and year typed the Brazilian way, with any common separator ("1/2/2026",
 * "01-02-2026", "01.02.2026"), compact ("01022026") or ISO ("2026-02-01").
 */
function readDateParts(input: string): DateParts | undefined {
  const brazilian = /^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{4})$/.exec(input);
  if (brazilian) return { day: Number(brazilian[1]), month: Number(brazilian[2]), year: Number(brazilian[3]) };

  const compact = /^(\d{2})(\d{2})(\d{4})$/.exec(input);
  if (compact) return { day: Number(compact[1]), month: Number(compact[2]), year: Number(compact[3]) };

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (iso) return { day: Number(iso[3]), month: Number(iso[2]), year: Number(iso[1]) };

  return undefined;
}

/** Parses the date typed in Portuguese filter fields without relying on browser locale or validation. */
export function parseDateFilter(value: string | null | undefined, endOfDay = false) {
  const input = value?.trim();
  if (!input) return undefined;

  const parts = readDateParts(input);
  if (!parts) return undefined;

  const { day, month, year } = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return undefined;
  }
  if (endOfDay) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

/** True when both dates are valid and the start comes after the end (same day is fine). */
export function isInvertedDateRange(fromValue: string | null | undefined, toValue: string | null | undefined) {
  const from = parseDateFilter(fromValue);
  const to = parseDateFilter(toValue);
  if (!from || !to) return false;
  return from > to;
}

/** Shows a valid date as "dd/mm/aaaa"; anything else is returned as typed so the person can fix it. */
export function formatDateFilter(value: string | null | undefined) {
  if (!value) return "";
  const date = parseDateFilter(value);
  if (!date) return value;

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

/** A typed value that is not a date: the filter ignores it and the field says so. */
export function isInvalidDateFilter(value: string | null | undefined) {
  return Boolean(value?.trim()) && !parseDateFilter(value);
}
