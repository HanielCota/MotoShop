/**
 * Columns of the seller home grids, chosen from how many blocks the member's role can see, so a role
 * that sees fewer blocks never gets empty columns beside them. Full class strings keep Tailwind able to
 * find them.
 */
const overviewStatsColumns: Readonly<Record<number, string>> = {
  1: "grid gap-3",
  2: "grid gap-3 sm:grid-cols-2",
  3: "grid gap-3 sm:grid-cols-3",
};

/** Indicator cards at the top: one column per visible card, up to four. */
export function overviewStatsGridClassName(visibleCards: number): string {
  return overviewStatsColumns[visibleCards] ?? "grid gap-3 sm:grid-cols-2 lg:grid-cols-4";
}

/** Low stock and finance panels: side by side only when both are visible. */
export function dashboardPanelsGridClassName(visiblePanels: number): string {
  return visiblePanels >= 2 ? "grid gap-6 lg:grid-cols-2" : "grid gap-6";
}
