import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DisclosureProps = {
  /** Text of the trigger, e.g. "Solicitar devolução". */
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /**
   * `button`: trigger that looks like a secondary button, for secondary actions.
   * `section`: full-width 44px header with a rotating chevron, for collapsible blocks such as
   * filters, the Admin navigation or optional parts of a form (DS-09).
   */
  variant?: "button" | "section";
  className?: string;
};

const summaryClassNames = {
  button:
    "border-input bg-background text-foreground hover:bg-muted inline-flex min-h-11 items-center gap-2 rounded-md border px-4 text-sm font-semibold transition-colors sm:min-h-9",
  section: "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-4 text-sm font-semibold",
} as const;

const focusClassName = "focus-visible:ring-ring/40 focus-visible:ring-3 focus-visible:outline-none";

/**
 * Native, accessible collapsible section (keyboard and screen reader support come from <details>).
 */
export function Disclosure({ summary, children, defaultOpen = false, variant = "button", className }: DisclosureProps) {
  const section = variant === "section";
  return (
    <details className={cn("group", section && "bg-card rounded-xl border", className)} open={defaultOpen}>
      <summary
        className={cn(
          "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
          summaryClassNames[variant],
          focusClassName,
        )}
      >
        {section ? <span className="min-w-0">{summary}</span> : summary}
        <ChevronDown
          data-disclosure-icon
          aria-hidden="true"
          className="text-muted-foreground size-4 shrink-0 transition-transform"
        />
      </summary>
      <div className={section ? "px-4 pb-4" : "mt-3"}>{children}</div>
    </details>
  );
}
