import { describe, expect, it } from "vitest";

import { hasSellerPermission } from "./seller-permissions";

describe("hasSellerPermission", () => {
  it("allows owners to manage seller members", () => {
    expect(hasSellerPermission("OWNER", "SELLER_MANAGE")).toBe(true);
  });

  it("keeps catalog members away from financial data", () => {
    expect(hasSellerPermission("CATALOG", "FINANCE_READ")).toBe(false);
  });
});
