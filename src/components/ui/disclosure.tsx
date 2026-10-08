import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DisclosureProps = {
  /** Text of the trigger, e.g. "Solicitar devolução". */
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
};

/**
 * Native, accessible collapsible section (keyboard and screen reader support come from <details>).
 * The trigger looks like a secondary button; use it for secondary actions that would otherwise
 * expand a whole form on the page.
 */
export function Disclosure({ summary, children, defaultOpen = false, className }: DisclosureProps) {
  return (
    <details className={cn("group", className)} open={defaultOpen}>
      <summary className="border-input bg-background text-foreground hover:bg-muted focus-visible:ring-ring/40 inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md border px-4 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:outline-none sm:min-h-9 [&::-webkit-details-marker]:hidden">
        {summary}
        <ChevronDown
          data-disclosure-icon
          aria-hidden="true"
          className="text-muted-foreground size-4 transition-transform"
        />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
