"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { ClipboardList, LayoutDashboard, MessageCircleQuestion, Plug, Truck } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/seller", label: "Visão geral", icon: LayoutDashboard },
  { href: "/seller/orders", label: "Pedidos", icon: ClipboardList },
  { href: "/seller/questions", label: "Perguntas", icon: MessageCircleQuestion },
  { href: "/seller/shipping", label: "Frete próprio", icon: Truck },
  { href: "/seller/shipping/integrations" as Route, label: "Integrações de frete", icon: Plug },
] as const;

export function SellerNavigation() {
  const pathname = usePathname();

  return (
    <nav
      className="border-border -mx-1 flex gap-1 overflow-x-auto border-b px-1 pb-2"
      aria-label="Navegação da Central do Lojista"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/seller" || href === "/seller/shipping" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-[color,border-color] duration-150 ease-out",
              active
                ? "border-moto-brand text-moto-brand-strong"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
