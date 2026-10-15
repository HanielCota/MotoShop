import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { SignOutButton } from "@/modules/auth/components/sign-out-button";

type AppAreaHeaderProps = {
  /** Area name, e.g. "Central do Lojista". */
  area: string;
  /** Secondary line: the store name or a short area description. */
  subtitle?: string | null;
  icon: LucideIcon;
};

/** Shared top bar for the operational areas (seller center and admin). */
export function AppAreaHeader({ area, subtitle, icon: Icon }: AppAreaHeaderProps) {
  return (
    <header className="bg-surface-sunken border-border flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="bg-moto-brand-surface text-brand-strong grid size-9 shrink-0 place-items-center rounded-lg">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="eyebrow text-brand-strong">{area}</p>
          {subtitle ? <p className="truncate text-sm font-semibold">{subtitle}</p> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Link
          href="/products"
          className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors"
        >
          <span className="hidden sm:inline">Ver marketplace</span>
          <span className="sm:hidden">Loja</span>
        </Link>
        <SignOutButton className="text-muted-foreground hover:text-foreground hover:bg-muted min-h-11 rounded-md" />
      </div>
    </header>
  );
}
