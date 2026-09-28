import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type InlineNoticeProps = ComponentProps<"div"> & { tone?: "info" | "warning" | "error" | "success" };

export function InlineNotice({ className, tone = "info", role, ...props }: InlineNoticeProps) {
  return (
    <div
      data-slot="inline-notice"
      role={role ?? (tone === "error" ? "alert" : undefined)}
      className={cn(
        "rounded-lg border p-3 text-sm",
        tone === "info" && "border-border bg-muted/50 text-foreground",
        tone === "warning" &&
          "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100",
        tone === "error" && "border-destructive/30 bg-destructive/10 text-destructive",
        tone === "success" &&
          "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100",
        className,
      )}
      {...props}
    />
  );
}
