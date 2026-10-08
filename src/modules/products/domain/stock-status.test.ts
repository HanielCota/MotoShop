import { describe, expect, it } from "vitest";

import { getPublicStockStatus, LAST_UNITS_THRESHOLD, publicStockStatusLabel } from "./stock-status";

describe("getPublicStockStatus", () => {
  it("treats zero, negative and invalid quantities as sold out", () => {
    expect(getPublicStockStatus(0)).toBe("out-of-stock");
    expect(getPublicStockStatus(-2)).toBe("out-of-stock");
    expect(getPublicStockStatus(Number.NaN)).toBe("out-of-stock");
  });

  it("flags last units up to the threshold (inclusive)", () => {
    expect(LAST_UNITS_THRESHOLD).toBe(3);
    expect(getPublicStockStatus(1)).toBe("last-units");
    expect(getPublicStockStatus(LAST_UNITS_THRESHOLD)).toBe("last-units");
    expect(getPublicStockStatus(LAST_UNITS_THRESHOLD + 1)).toBe("in-stock");
  });

  it("exposes Portuguese labels", () => {
    expect(publicStockStatusLabel["last-units"]).toBe("Últimas unidades");
    expect(publicStockStatusLabel["out-of-stock"]).toBe("Esgotado");
  });
});
