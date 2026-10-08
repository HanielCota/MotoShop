"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClipboardList,
  LayoutDashboard,
  MessageCircleQuestion,
  Package,
  Settings,
  TicketPercent,
  Truck,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

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
  { href: "/seller/orders", label: "Pedidos", icon: ClipboardList, visible: (p) => p.canReadOrders },
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
  const navRef = useRef<HTMLElement>(null);
  const [overflow, setOverflow] = useState({ start: false, end: false });

  const updateOverflow = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const start = nav.scrollLeft > 4;
    const end = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 4;
    setOverflow((current) => (current.start === start && current.end === end ? current : { start, end }));
  }, []);

  // Mantém a aba ativa visível no mobile (sem rolar a página verticalmente).
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && active) {
      const left = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
      if (typeof nav.scrollTo === "function") nav.scrollTo({ left: Math.max(0, left) });
    }
    updateOverflow();
  }, [pathname, updateOverflow]);

  useEffect(() => {
    window.addEventListener("resize", updateOverflow);
    return () => window.removeEventListener("resize", updateOverflow);
  }, [updateOverflow]);

  return (
    <div className="relative -mx-4 sm:mx-0">
      <span
        aria-hidden="true"
        className={cn(
          "from-background pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-linear-to-r to-transparent transition-opacity",
          overflow.start ? "opacity-100" : "opacity-0",
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "from-background pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-linear-to-l to-transparent transition-opacity",
          overflow.end ? "opacity-100" : "opacity-0",
        )}
      />
      <nav
        ref={navRef}
        onScroll={updateOverflow}
        className="border-border relative flex snap-x [scrollbar-width:none] gap-1 overflow-x-auto scroll-smooth border-b px-4 sm:px-0 [&::-webkit-scrollbar]:hidden"
        aria-label="Navegação da Central do Lojista"
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
      </nav>
    </div>
  );
}
