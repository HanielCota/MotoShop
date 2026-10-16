"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageCircleQuestion,
  Package,
  Settings,
  TicketPercent,
  Truck,
  type LucideIcon,
} from "lucide-react";

import { ScrollableTabs } from "@/components/ui/scrollable-tabs";
import { cn } from "@/lib/utils";
import { domainIcons } from "@/shared/presentation/domain-icons";

export type SellerNavigationPermissions = {
  canReadOrders: boolean;
  canManageCatalog: boolean;
  canManageStore: boolean;
  canManageCoupons: boolean;
};

type NavigationItem = {
  href: Route;
  label: string;
  icon: LucideIcon;
  visible: (permissions: SellerNavigationPermissions) => boolean;
};

const items: NavigationItem[] = [
  { href: "/seller", label: "Visão geral", icon: LayoutDashboard, visible: () => true },
  { href: "/seller/orders", label: "Pedidos", icon: domainIcons.order, visible: (p) => p.canReadOrders },
  { href: "/seller/products" as Route, label: "Produtos", icon: Package, visible: (p) => p.canManageCatalog },
  { href: "/seller/questions", label: "Perguntas", icon: MessageCircleQuestion, visible: (p) => p.canManageCatalog },
  { href: "/seller/shipping" as Route, label: "Frete", icon: Truck, visible: (p) => p.canManageStore },
  { href: "/seller/coupons" as Route, label: "Cupons", icon: TicketPercent, visible: (p) => p.canManageCoupons },
  { href: "/seller/settings" as Route, label: "Configurações", icon: Settings, visible: () => true },
];

export function isSellerNavigationItemActive(href: string, pathname: string) {
  if (href === "/seller") return pathname === "/seller";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SellerNavigation({ permissions }: { permissions: SellerNavigationPermissions }) {
  const pathname = usePathname();

  return (
    <ScrollableTabs
      aria-label="Navegação da Central do Lojista"
      activeKey={pathname}
      wrapperClassName="-mx-4 sm:mx-0"
      className="border-border relative snap-x gap-1 border-b px-4 sm:px-0"
    >
      {items
        .filter((item) => item.visible(permissions))
        .map(({ href, label, icon: Icon }) => {
          const active = isSellerNavigationItemActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 shrink-0 snap-start items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-[color,border-color] duration-150 ease-out sm:px-4",
                active
                  ? "border-moto-brand text-brand-strong"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
    </ScrollableTabs>
  );
}
