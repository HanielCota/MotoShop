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

const fourColumnStatsClassName = "grid gap-3 sm:grid-cols-2 lg:grid-cols-4";
const minimumPanelsSideBySide = 2;

/** Indicator cards each role sees: orders, then questions and low stock (catalog), then month sales. */
export function countOverviewStatCards(permissions: {
  canReadOrders: boolean;
  canManageCatalog: boolean;
  canReadFinances: boolean;
}): number {
  const catalogCards = permissions.canManageCatalog ? 2 : 0;

  return Number(permissions.canReadOrders) + catalogCards + Number(permissions.canReadFinances);
}

/** Indicator cards at the top: one column per visible card, up to four. */
export function overviewStatsGridClassName(visibleCards: number): string {
  return overviewStatsColumns[visibleCards] ?? fourColumnStatsClassName;
}

/** Low stock and finance panels: side by side only when both are visible. */
export function dashboardPanelsGridClassName(visiblePanels: number): string {
  return visiblePanels >= minimumPanelsSideBySide ? "grid gap-6 lg:grid-cols-2" : "grid gap-6";
}
