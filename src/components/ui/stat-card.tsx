import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * `attention` colore só o número e o ícone: com várias filas pendentes ao mesmo tempo, cards inteiros em
 * laranja deixariam de chamar atenção.
 */
type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: Route;
  icon?: LucideIcon;
  tone?: "default" | "attention";
  className?: string;
};

export function StatCard({ label, value, hint, href, icon: Icon, tone = "default", className }: StatCardProps) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        {Icon ? (
          <Icon
            aria-hidden="true"
            className={cn("size-4", tone === "attention" ? "text-brand-strong" : "text-muted-foreground")}
          />
        ) : null}
      </div>
      <p className={cn("font-heading text-3xl font-bold tabular-nums", tone === "attention" && "text-brand-strong")}>
        {value}
      </p>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </>
  );

  const classes = cn(
    "bg-card ring-foreground/10 flex flex-col gap-2 rounded-xl p-4 ring-1",
    href && "hover:ring-foreground/25 focus-visible:ring-ring transition-shadow",
    className,
  );

  return href ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  );
}
