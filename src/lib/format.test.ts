import { afterEach, describe, expect, it, vi } from "vitest";

import { currentMarketplaceYear, formatCount, formatMoneyInCentsForSpreadsheet, formatPercentFromBps } from "./format";

describe("formatCount", () => {
  it("uses the singular only for exactly one", () => {
    expect(formatCount(1, "pedido", "pedidos")).toBe("1 pedido");
    expect(formatCount(0, "pedido", "pedidos")).toBe("0 pedidos");
    expect(formatCount(2, "item", "itens")).toBe("2 itens");
  });

  it("groups thousands the Brazilian way", () => {
    expect(formatCount(1250, "evento", "eventos")).toBe("1.250 eventos");
  });
});

describe("formatPercentFromBps", () => {
  it("formats basis points as a Brazilian percentage", () => {
    expect(formatPercentFromBps(1200)).toBe("12%");
    expect(formatPercentFromBps(1050)).toBe("10,5%");
    expect(formatPercentFromBps(1)).toBe("0,01%");
  });
});

describe("formatMoneyInCentsForSpreadsheet", () => {
  it("writes reais with a decimal comma and no thousands dot or currency symbol", () => {
    expect(formatMoneyInCentsForSpreadsheet(3_903_368)).toBe("39033,68");
    expect(formatMoneyInCentsForSpreadsheet(0)).toBe("0,00");
    expect(formatMoneyInCentsForSpreadsheet(5)).toBe("0,05");
  });
});

describe("currentMarketplaceYear", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the old year until midnight in São Paulo, not in UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-01T02:00:00Z"));

    const year = currentMarketplaceYear();

    expect(year).toBe("2026");
  });

  it("turns the year at midnight in São Paulo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-01T03:00:00Z"));

    const year = currentMarketplaceYear();

    expect(year).toBe("2027");
  });
});
