import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: { label: string; href: Route } | ReactNode;
  variant?: "card" | "inline";
  className?: string;
};

function isLinkAction(action: EmptyStateProps["action"]): action is { label: string; href: Route } {
  return typeof action === "object" && action !== null && "href" in action && "label" in action;
}

export function EmptyState({ title, description, icon: Icon, action, variant = "card", className }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center gap-3 text-center",
        variant === "card" && "border-border bg-card rounded-xl border border-dashed px-6 py-10",
        variant === "inline" && "py-6",
        className,
      )}
    >
      {Icon ? (
        <span className="bg-muted text-muted-foreground grid size-11 place-items-center rounded-full">
          <Icon aria-hidden="true" className="size-5" />
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="text-foreground font-semibold">{title}</p>
        {description ? <p className="text-muted-foreground max-w-md text-sm">{description}</p> : null}
      </div>
      {isLinkAction(action) ? (
        <Link href={action.href} className={cn(buttonVariants({ size: "sm" }), "mt-1")}>
          {action.label}
        </Link>
      ) : (
        action
      )}
    </div>
  );
}
