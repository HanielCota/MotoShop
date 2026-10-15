import { parseDateFilter } from "@/lib/date-filter";

/** Aceita `dd/mm/aaaa` (campo do Admin) e `aaaa-mm-dd` (links antigos), sempre em limites UTC. */
export function parseDateBoundary(value: string | null | undefined, endOfDay: boolean) {
  return parseDateFilter(value, endOfDay);
}

/** Filtro `createdAt` com limites UTC: `from` inclusivo e `to` exclusivo no dia seguinte. */
export function buildCreatedAtBoundaryFilter(fromValue: string | null | undefined, toValue: string | null | undefined) {
  const from = parseDateBoundary(fromValue, false);
  const to = parseDateBoundary(toValue, true);
  if (!from && !to) return {};
  return { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } };
}
