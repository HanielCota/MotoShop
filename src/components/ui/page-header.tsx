import type { Route } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: Route; label: string };
  className?: string;
};

/** Cabeçalho padrão de página: garante um único `h1` e hierarquia consistente. */
export function PageHeader({ title, eyebrow, description, actions, back, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-2">
        {back ? (
          <Link
            href={back.href}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {back.label}
          </Link>
        ) : null}
        {eyebrow ? (
          <p className="text-brand-strong text-xs font-semibold tracking-[0.14em] uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="text-3xl text-balance sm:text-4xl">{title}</h1>
        {description ? <p className="text-muted-foreground max-w-2xl text-sm sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Variante para seções dentro de uma página (renderiza `h2`). */
export function SectionHeader({
  title,
  description,
  actions,
  className,
}: Omit<PageHeaderProps, "eyebrow" | "back">) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        <h2 className="text-xl sm:text-2xl">{title}</h2>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
