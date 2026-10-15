export type SellerMemberRoleValue = "OWNER" | "ADMIN" | "CATALOG" | "ORDERS" | "FINANCE";

const PRIVILEGED_ROLES: readonly SellerMemberRoleValue[] = ["OWNER", "ADMIN"];

/**
 * Quem pode criar, mudar ou remover um membro da equipe (L-17).
 * O OWNER nunca é alterado por aqui. Só o OWNER mexe em ADMINs; um ADMIN gerencia apenas
 * os papéis operacionais (CATALOG, ORDERS, FINANCE) e não pode promover ninguém a ADMIN.
 */
export function canManageSellerMember(input: {
  actorRole: SellerMemberRoleValue;
  currentRole: SellerMemberRoleValue | null;
  nextRole: SellerMemberRoleValue | null;
}): boolean {
  if (input.currentRole === "OWNER" || input.nextRole === "OWNER") return false;
  if (input.actorRole === "OWNER") return true;
  if (input.actorRole !== "ADMIN") return false;
  if (input.currentRole && PRIVILEGED_ROLES.includes(input.currentRole)) return false;
  return input.nextRole === null || !PRIVILEGED_ROLES.includes(input.nextRole);
}
