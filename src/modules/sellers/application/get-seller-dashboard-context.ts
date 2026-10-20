import "server-only";

import { cache } from "react";
import type { SellerStatus } from "@/generated/prisma/enums";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";

import { requireAuthenticatedUser, requireSellerAccess } from "@/modules/auth/application/authorization";
import {
  hasSellerPermission,
  type SellerMemberRole,
  type SellerPermission,
} from "@/modules/auth/domain/seller-permissions";
import { sellerPermissionDeniedPath } from "@/modules/sellers/domain/permission-denied";
import { getUserSellerMemberships } from "@/modules/sellers/queries/sellers";

/** Capacidades da Central do Lojista derivadas do papel do membro (fonte única do gating de UI). */
export type SellerDashboardPermissions = {
  canManageStore: boolean;
  canManageCatalog: boolean;
  canCreateProduct: boolean;
  canManageCoupons: boolean;
  canReadFinances: boolean;
  canReadOrders: boolean;
  canUpdateOrders: boolean;
};

export function getSellerDashboardPermissions(role: SellerMemberRole): SellerDashboardPermissions {
  return {
    canManageStore: hasSellerPermission(role, "SELLER_MANAGE"),
    canManageCatalog: hasSellerPermission(role, "PRODUCT_UPDATE"),
    canCreateProduct: hasSellerPermission(role, "PRODUCT_CREATE"),
    canManageCoupons: hasSellerPermission(role, "COUPON_MANAGE"),
    canReadFinances: hasSellerPermission(role, "FINANCE_READ"),
    canReadOrders: hasSellerPermission(role, "ORDER_READ"),
    canUpdateOrders: hasSellerPermission(role, "ORDER_UPDATE"),
  };
}

function isApprovedSellerStatus(status: SellerStatus): boolean {
  return status === "APPROVED" || status === "ACTIVE";
}

type Membership = Awaited<ReturnType<typeof getUserSellerMemberships>>[number];
export type DashboardSeller = Membership["seller"];
type PendingSeller = DashboardSeller & { status: Exclude<SellerStatus, "APPROVED" | "ACTIVE"> };

export type SellerDashboardContext =
  | { status: "no-seller" }
  | { status: "pending"; seller: PendingSeller }
  | {
      status: "ready";
      userId: string;
      membership: Membership;
      seller: DashboardSeller;
      permissions: SellerDashboardPermissions;
    };

/**
 * Resolve a loja do usuário para a Central do Lojista (inclui equipe e assinatura VIP).
 * Memoizado por requisição: layout e página compartilham a mesma consulta.
 */
export const getSellerDashboardContext = cache(async (): Promise<SellerDashboardContext> => {
  const session = await requireAuthenticatedUser("/seller");
  const memberships = await getUserSellerMemberships(session.user.id);
  // Same choice as requireSellerAccess: an approved store wins over an older one still under review.
  const membership = memberships.find((item) => isApprovedSellerStatus(item.seller.status)) ?? memberships[0];
  if (!membership) return { status: "no-seller" };
  const { seller } = membership;
  if (!isApprovedSellerStatus(seller.status)) {
    return { status: "pending", seller: seller as PendingSeller };
  }
  return {
    status: "ready",
    userId: session.user.id,
    membership,
    seller,
    permissions: getSellerDashboardPermissions(membership.role),
  };
});

/**
 * Exige loja aprovada com vitrine (e, opcionalmente, uma permissão), com a mesma semântica de
 * `requireSellerAccess`: quem não é membro recebe 404, loja em análise volta para /seller e
 * membro sem a permissão vai para a página de área restrita.
 */
export async function requireSellerDashboardContext(permission?: SellerPermission) {
  const context = await getSellerDashboardContext();
  if (context.status === "no-seller") notFound();
  if (context.status !== "ready" || !context.seller.store) redirect("/seller");
  if (permission && !hasSellerPermission(context.membership.role, permission)) {
    redirect(sellerPermissionDeniedPath(permission) as Route);
  }
  return { ...context, store: context.seller.store };
}

/**
 * Para páginas que só precisam da loja e da permissão: reaproveita `requireSellerAccess`
 * e acrescenta as capacidades derivadas do papel.
 */
export async function requireSellerPageContext(permission?: SellerPermission) {
  const access = await requireSellerAccess(permission);
  return { ...access, permissions: getSellerDashboardPermissions(access.membership.role) };
}
