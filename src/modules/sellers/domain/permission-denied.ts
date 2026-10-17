import {
  hasSellerPermission,
  type SellerMemberRole,
  type SellerPermission,
} from "@/modules/auth/domain/seller-permissions";

const sellerMemberRoles: readonly SellerMemberRole[] = ["OWNER", "ADMIN", "CATALOG", "ORDERS", "FINANCE"];

/** How each role reads in "Esta área é ... da loja". */
const roleOwnershipPhrases: Record<SellerMemberRole, string> = {
  OWNER: "do dono",
  ADMIN: "do administrador",
  CATALOG: "da equipe de catálogo",
  ORDERS: "da equipe de pedidos",
  FINANCE: "do financeiro",
};

/** What the member was trying to do, used in "Para ..., peça a ...". */
const actionByPermission: Record<SellerPermission, string> = {
  PRODUCT_CREATE: "cadastrar produtos",
  PRODUCT_UPDATE: "cuidar dos produtos e do estoque",
  PRODUCT_DELETE: "remover produtos",
  ORDER_READ: "ver os pedidos",
  ORDER_UPDATE: "atualizar os pedidos",
  FINANCE_READ: "ver o financeiro",
  COUPON_MANAGE: "criar ou mudar cupons",
  SELLER_MANAGE: "mudar as configurações da loja",
};

/** Page a member is sent to when their role does not include the permission of the area they opened. */
export function sellerPermissionDeniedPath(permission: SellerPermission) {
  return `/seller/sem-permissao?permissao=${permission}`;
}

export function rolesWithPermission(permission: SellerPermission): SellerMemberRole[] {
  return sellerMemberRoles.filter((role) => hasSellerPermission(role, permission));
}

/** "a, b ou c" */
function joinAsList(items: readonly string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ou ${items.at(-1)}`;
}

/**
 * Title and explanation of the restricted area, built from the permission table. Only the owner or an
 * administrator changes a member's role, so the explanation points to them.
 */
export function describePermissionDenied(permission: SellerPermission, memberRoleLabel: string, storeName: string) {
  const owners = rolesWithPermission(permission).map((role) => roleOwnershipPhrases[role]);
  return {
    title: `Esta área é ${joinAsList(owners)} da loja`,
    description: `Seu papel na equipe da ${storeName} é ${memberRoleLabel}. Para ${actionByPermission[permission]}, peça ao dono ou ao administrador da loja que mude o seu papel.`,
  };
}
