import Link from "next/link";
import { MapPin, Bell, PackageCheck, Heart, Bike } from "lucide-react";

import { ScrollableTabs } from "@/components/ui/scrollable-tabs";

const links = [
  { href: "/orders", label: "Meus pedidos", icon: PackageCheck },
  { href: "/favorites", label: "Favoritos", icon: Heart },
  { href: "/account/motorcycles", label: "Minhas motos", icon: Bike },
  { href: "/account/addresses", label: "Endereços", icon: MapPin },
  { href: "/account/notifications", label: "Notificações", icon: Bell },
] as const;

export function CustomerAccountNavigation({ pathname }: { pathname: string }) {
  return (
    <aside className="border-border bg-card h-fit min-w-0 rounded-xl border p-3 lg:sticky lg:top-24">
      <p className="text-muted-foreground hidden px-3 pt-1 pb-2 text-xs font-semibold tracking-wide uppercase lg:block">
        Minha conta
      </p>
      <ScrollableTabs
        aria-label="Navegação da conta"
        activeKey={pathname}
        fadeFromClassName="from-card"
        className="gap-1 lg:grid lg:grid-cols-1 lg:overflow-visible"
      >
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/orders" ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="text-foreground hover:bg-muted aria-[current=page]:bg-moto-brand-surface aria-[current=page]:text-brand-strong focus-visible:ring-ring/40 flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none"
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </ScrollableTabs>
    </aside>
  );
}
