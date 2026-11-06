import { describe, expect, it } from "vitest";

import { getPublicStockStatus, publicStockStatusLabel } from "./stock-status";

describe("getPublicStockStatus", () => {
  it("treats zero, negative and invalid quantities as sold out", () => {
    expect(getPublicStockStatus(0, 3)).toBe("out-of-stock");
    expect(getPublicStockStatus(-2, 3)).toBe("out-of-stock");
    expect(getPublicStockStatus(Number.NaN, 3)).toBe("out-of-stock");
  });

  it("flags last units up to the threshold (inclusive)", () => {
    expect(getPublicStockStatus(1, 3)).toBe("last-units");
    expect(getPublicStockStatus(3, 3)).toBe("last-units");
    expect(getPublicStockStatus(4, 3)).toBe("in-stock");
  });

  it("follows the threshold configured in the Admin", () => {
    const status = getPublicStockStatus(8, 10);

    expect(status).toBe("last-units");
  });

  it("exposes Portuguese labels", () => {
    expect(publicStockStatusLabel["last-units"]).toBe("Últimas unidades");
    expect(publicStockStatusLabel["out-of-stock"]).toBe("Esgotado");
  });
});
