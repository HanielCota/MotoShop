"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, LayoutDashboard, MessageCircleQuestion, Truck } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/seller", label: "Visão geral", icon: LayoutDashboard },
  { href: "/seller/orders", label: "Pedidos", icon: ClipboardList },
  { href: "/seller/questions", label: "Perguntas", icon: MessageCircleQuestion },
  { href: "/seller/shipping", label: "Frete próprio", icon: Truck },
] as const;

export function SellerNavigation() {
  const pathname = usePathname();

  return (
    <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Navegação da Central do Lojista">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/seller" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors",
              active
                ? "border-[#f6b28d] bg-[#fff1e9] text-[#a8370c]"
                : "border-[#e1dcd3] bg-white text-[#4d4c49] hover:border-[#f2a478] hover:text-[#a8370c]",
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
