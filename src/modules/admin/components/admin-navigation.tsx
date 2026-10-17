"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

import { Disclosure } from "@/components/ui/disclosure";

import { adminSections } from "../admin-sections";

const groups = ["Marketplace", "Operação", "Sistema"] as const;

function AdminLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Áreas administrativas" className="space-y-5">
      <Link
        href="/admin"
        aria-current={pathname === "/admin" ? "page" : undefined}
        className="text-foreground/80 hover:bg-muted hover:text-foreground aria-[current=page]:bg-foreground aria-[current=page]:text-background block rounded-md px-3 py-2 text-sm font-semibold transition-colors"
      >
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
                return (
                  <Link
                    key={section.slug}
                    href={href as Route}
                    aria-current={pathname === href ? "page" : undefined}
                    className="text-foreground/80 hover:bg-muted hover:text-foreground aria-[current=page]:bg-foreground aria-[current=page]:text-background block rounded-md px-3 py-2 text-sm font-medium transition-colors"
                  >
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
