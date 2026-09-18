export const sellerPermissions = [
  "PRODUCT_CREATE",
  "PRODUCT_UPDATE",
  "PRODUCT_DELETE",
  "ORDER_READ",
  "ORDER_UPDATE",
  "FINANCE_READ",
  "COUPON_MANAGE",
  "SELLER_MANAGE",
] as const;

export type SellerPermission = (typeof sellerPermissions)[number];
export type SellerMemberRole = "OWNER" | "ADMIN" | "CATALOG" | "ORDERS" | "FINANCE";

const permissionsByRole = {
  OWNER: sellerPermissions,
  ADMIN: sellerPermissions,
  CATALOG: ["PRODUCT_CREATE", "PRODUCT_UPDATE", "PRODUCT_DELETE"] as const,
  ORDERS: ["ORDER_READ", "ORDER_UPDATE"] as const,
  FINANCE: ["ORDER_READ", "FINANCE_READ", "COUPON_MANAGE"] as const,
} satisfies Record<SellerMemberRole, readonly SellerPermission[]>;

export function hasSellerPermission(role: SellerMemberRole, permission: SellerPermission): boolean {
  return (permissionsByRole[role] as readonly SellerPermission[]).includes(permission);
}
