"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

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
      <details key={pathname} className="bg-card rounded-lg border p-3 lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-1 py-1 text-sm font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
          Navegar pelo Admin{" "}
          <ChevronDown aria-hidden="true" className="size-4 transition-transform [details[open]_&]:rotate-180" />
        </summary>
        <div className="mt-4 border-t pt-4">
          <AdminLinks />
        </div>
      </details>
      <aside className="bg-card hidden self-start rounded-lg border p-3 lg:sticky lg:top-6 lg:block">
        <AdminLinks />
      </aside>
    </>
  );
}
