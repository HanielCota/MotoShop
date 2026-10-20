import { describe, expect, it } from "vitest";

import { countOverviewStatCards, dashboardPanelsGridClassName, overviewStatsGridClassName } from "./dashboard-grid";

describe("seller home grids follow the blocks each role can see", () => {
  it("never leaves empty columns beside the indicator cards", () => {
    expect(overviewStatsGridClassName(1)).toBe("grid gap-3");
    expect(overviewStatsGridClassName(2)).toBe("grid gap-3 sm:grid-cols-2");
    expect(overviewStatsGridClassName(3)).toBe("grid gap-3 sm:grid-cols-3");
    expect(overviewStatsGridClassName(4)).toBe("grid gap-3 sm:grid-cols-2 lg:grid-cols-4");
    expect(overviewStatsGridClassName(2)).not.toContain("lg:grid-cols-4");
  });

  it("lets a single panel take the full width", () => {
    expect(dashboardPanelsGridClassName(1)).toBe("grid gap-6");
    expect(dashboardPanelsGridClassName(2)).toBe("grid gap-6 lg:grid-cols-2");
  });
});

describe("indicator cards per role", () => {
  it("counts the cards each role sees, so the loading placeholders match them", () => {
    const none = { canReadOrders: false, canManageCatalog: false, canReadFinances: false };

    expect(countOverviewStatCards({ ...none, canReadOrders: true })).toBe(1);
    expect(countOverviewStatCards({ ...none, canManageCatalog: true })).toBe(2);
    expect(countOverviewStatCards({ ...none, canReadOrders: true, canReadFinances: true })).toBe(2);
    expect(countOverviewStatCards({ canReadOrders: true, canManageCatalog: true, canReadFinances: true })).toBe(4);
  });
});
