import type { SellerMemberRoleValue } from "./member-management";

export const sellerMemberRoleLabels: Record<SellerMemberRoleValue, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  CATALOG: "Catálogo",
  ORDERS: "Pedidos",
  FINANCE: "Financeiro",
};

export function getSellerMemberRoleLabel(role: string): string {
  return sellerMemberRoleLabels[role as SellerMemberRoleValue] ?? role;
}
