import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type InlineNoticeProps = ComponentProps<"div"> & { tone?: "info" | "warning" | "error" | "success" };

export function InlineNotice({ className, tone = "info", role, ...props }: InlineNoticeProps) {
  return (
    <div
      data-slot="inline-notice"
      role={role ?? (tone === "error" ? "alert" : tone === "success" ? "status" : undefined)}
      className={cn(
        "rounded-lg border p-3 text-sm",
        tone === "info" && "border-border bg-muted/50 text-foreground",
        tone === "warning" &&
          "border-warning/40 bg-warning-surface text-warning-foreground",
        tone === "error" && "border-destructive/30 bg-destructive/10 text-destructive",
        tone === "success" &&
          "border-success/30 bg-success-surface text-success-foreground",
        className,
      )}
      {...props}
    />
  );
}
