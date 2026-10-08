import { describe, expect, it } from "vitest";

import { hasSellerPermission, sellerPermissions, type SellerMemberRole } from "./seller-permissions";

describe("hasSellerPermission", () => {
  const matrix: Record<SellerMemberRole, readonly (typeof sellerPermissions)[number][]> = {
    OWNER: sellerPermissions,
    ADMIN: sellerPermissions,
    CATALOG: ["PRODUCT_CREATE", "PRODUCT_UPDATE", "PRODUCT_DELETE"],
    ORDERS: ["ORDER_READ", "ORDER_UPDATE"],
    FINANCE: ["ORDER_READ", "FINANCE_READ", "COUPON_MANAGE"],
  };

  it.each(
    Object.entries(matrix).flatMap(([role, allowed]) =>
      sellerPermissions.map(
        (permission) => [role as SellerMemberRole, permission, allowed.includes(permission)] as const,
      ),
    ),
  )("%s %s => %s", (role, permission, expected) => {
    expect(hasSellerPermission(role, permission)).toBe(expected);
  });
});
