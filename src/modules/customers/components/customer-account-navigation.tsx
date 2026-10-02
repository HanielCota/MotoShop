import Link from "next/link";
import { MapPin, Bell, PackageCheck } from "lucide-react";

const links = [
  { href: "/orders", label: "Meus pedidos", icon: PackageCheck },
  { href: "/account/addresses", label: "Endereços", icon: MapPin },
  { href: "/account/notifications", label: "Notificações", icon: Bell },
] as const;

export function CustomerAccountNavigation({ pathname }: { pathname: string }) {
  return (
    <aside className="h-fit rounded-xl border bg-white p-3 lg:sticky lg:top-24" aria-label="Navegação da conta">
      <p className="text-muted-foreground px-3 pt-1 pb-2 text-xs font-semibold tracking-wide uppercase">Minha conta</p>
      <nav className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/orders" ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="text-foreground hover:bg-muted flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors aria-[current=page]:bg-[#fff0e8] aria-[current=page]:text-[#a63a0b]"
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
