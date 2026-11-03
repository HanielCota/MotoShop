import { isInvertedDateRange, parseDateFilter } from "@/lib/date-filter";
import { MARKETPLACE_TIME_ZONE } from "@/lib/format";
import { ApplicationError } from "@/shared/errors/application-error";

export const salesPeriodValues = ["today", "7d", "30d", "month", "custom"] as const;
export type SalesPeriod = (typeof salesPeriodValues)[number];

/** São Paulo has had no daylight saving time since 2019, so its midnight is always 03:00 UTC. */
const MARKETPLACE_UTC_OFFSET_HOURS = 3;
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
const DAYS_BEFORE_TODAY: Record<"today" | "7d" | "30d", number> = { today: 0, "7d": 6, "30d": 29 };

/** `start` is inclusive and `end` exclusive, both at a São Paulo midnight. */
export type SalesDateRange = { start: Date; end: Date };

type CalendarDay = { year: number; month: number; day: number };

function marketplaceCalendarDay(now: Date): CalendarDay {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MARKETPLACE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (type: "year" | "month" | "day") => {
    const value = Number(parts.find((part) => part.type === type)?.value);
    if (Number.isFinite(value) === false)
      throw new ApplicationError({
        code: "INTERNAL_ERROR",
        message: `Missing ${type} for ${now.toISOString()} in ${MARKETPLACE_TIME_ZONE}`,
      });

    return value;
  };

  return { year: read("year"), month: read("month"), day: read("day") };
}

function marketplaceMidnight({ year, month, day }: CalendarDay, daysToAdd = 0) {
  return new Date(Date.UTC(year, month - 1, day + daysToAdd, MARKETPLACE_UTC_OFFSET_HOURS));
}

/** A typed "dd/mm/aaaa" day as São Paulo midnight; `parseDateFilter` reads it at UTC midnight. */
function typedDayStart(value: string | null, endOfDay: boolean) {
  const date = parseDateFilter(value, endOfDay);
  if (date == null) return undefined;

  return new Date(date.getTime() + MARKETPLACE_UTC_OFFSET_HOURS * MILLISECONDS_PER_HOUR);
}

function customRange(from: string | null, to: string | null): SalesDateRange | null {
  if (isInvertedDateRange(from, to)) return null;

  const start = typedDayStart(from, false);
  const end = typedDayStart(to, true);
  if (start == null || end == null) return null;

  return { start, end };
}

/** The dates of a period in the marketplace time zone; null when a custom range is missing or invalid. */
export function resolveSalesDateRange(input: {
  period: SalesPeriod;
  from: string | null;
  to: string | null;
  now?: Date;
}): SalesDateRange | null {
  if (input.period === "custom") return customRange(input.from, input.to);

  const today = marketplaceCalendarDay(input.now ?? new Date());
  const end = marketplaceMidnight(today, 1);
  if (input.period === "month") return { start: marketplaceMidnight({ ...today, day: 1 }), end };

  return { start: marketplaceMidnight(today, -DAYS_BEFORE_TODAY[input.period]), end };
}

/** The last day inside the range, for labels such as "01/10/2026 a 26/10/2026". */
export function lastDayOf(range: SalesDateRange) {
  return new Date(range.end.getTime() - 1);
}
