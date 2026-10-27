"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  ChartColumn,
  Crown,
  FileX2,
  History,
  LayoutDashboard,
  Mail,
  MessageSquareWarning,
  Motorbike,
  PackageSearch,
  Percent,
  Plug,
  Scale,
  Send,
  Store,
  TicketPercent,
  Truck,
  Undo2,
  Webhook,
  type LucideIcon,
} from "lucide-react";

import { Disclosure } from "@/components/ui/disclosure";

import { domainIcons } from "@/shared/presentation/domain-icons";

import { adminSections, type AdminSection } from "../admin-sections";

const groups = ["Marketplace", "Operação", "Sistema"] as const;

/**
 * Each area uses the icon of its card on the Admin overview, so the same symbol means the same thing.
 * Keyed by slug rather than typed over every section, so a section added by another change (Vendas,
 * PR #83) keeps the build green; the navigation test fails if a section is left without an icon.
 */
const sectionIcons: Readonly<Partial<Record<AdminSection | "sales", LucideIcon>>> = {
  sales: ChartColumn,
  sellers: Store,
  products: PackageSearch,
  catalog: Motorbike,
  coupons: TicketPercent,
  vip: Crown,
  commission: Percent,
  orders: domainIcons.order,
  cancellations: FileX2,
  returns: Undo2,
  disputes: Scale,
  moderation: MessageSquareWarning,
  "shipping-recovery": Truck,
  integrations: Plug,
  webhooks: Webhook,
  emails: Mail,
  audit: History,
  outbox: Send,
};

const linkClassName =
  "text-foreground/80 hover:bg-muted hover:text-foreground aria-[current=page]:bg-foreground aria-[current=page]:text-background flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors";

function AdminLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Áreas administrativas" className="space-y-5">
      <Link
        href="/admin"
        aria-current={pathname === "/admin" ? "page" : undefined}
        className={`${linkClassName} font-semibold`}
      >
        <LayoutDashboard aria-hidden="true" className="size-4 shrink-0" />
        Visão geral
      </Link>
      {groups.map((group) => (
        <div key={group}>
          <p className="eyebrow text-muted-foreground px-3">{group}</p>
          <div className="mt-2 grid gap-0.5 max-lg:sm:grid-cols-2">
            {adminSections
              .filter((section) => section.group === group)
              .map((section) => {
                const href = `/admin/${section.slug}`;
                const Icon = sectionIcons[section.slug];
                return (
                  <Link
                    key={section.slug}
                    href={href as Route}
                    aria-current={pathname === href ? "page" : undefined}
                    className={`${linkClassName} font-medium`}
                  >
                    {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0" /> : null}
                    {section.title}
                  </Link>
                );
              })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AdminNavigation() {
  const pathname = usePathname();

  return (
    <>
      {/* Remonta a cada página para fechar depois de navegar; cabeçalho de 44px no celular (DS-09). */}
      <Disclosure key={pathname} variant="section" summary="Navegar pelo Admin" className="lg:hidden">
        <div className="border-t pt-4">
          <AdminLinks />
        </div>
      </Disclosure>
      <aside className="bg-card hidden self-start rounded-lg border p-3 lg:sticky lg:top-6 lg:block">
        <AdminLinks />
      </aside>
    </>
  );
}
