import type { LucideIcon } from "lucide-react";
import type { AriaRole, ReactNode } from "react";

import { cn } from "@/lib/utils";

type StatusPageProps = {
  title: string;
  description: ReactNode;
  icon?: LucideIcon | undefined;
  /** Small label above the title (e.g. "Erro 404"). */
  eyebrow?: string | undefined;
  /** Extra content between the text and the actions (e.g. a search form). */
  children?: ReactNode;
  actions?: ReactNode;
  role?: AriaRole | undefined;
  className?: string | undefined;
};

/**
 * Full-page status (404, forbidden, error boundaries): one layout for every area. Rendered inside
 * the area layout, or in a narrow centered `<main>` when it is the whole page.
 */
export function StatusPage({
  title,
  description,
  icon: Icon,
  eyebrow,
  children,
  actions,
  role,
  className,
}: StatusPageProps) {
  return (
    <section
      data-slot="status-page"
      role={role}
      className={cn("flex w-full flex-col items-start gap-5 py-12 sm:py-16", className)}
    >
      {Icon ? (
        <span className="bg-warning-surface text-warning-foreground grid size-12 place-items-center rounded-full">
          <Icon aria-hidden="true" className="size-6" />
        </span>
      ) : null}
      <div className="space-y-3">
        {eyebrow ? (
          <p className="text-brand-strong text-xs font-semibold tracking-[0.14em] uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="text-3xl text-balance sm:text-4xl">{title}</h1>
        <div className="text-muted-foreground max-w-xl">{description}</div>
      </div>
      {children}
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </section>
  );
}
