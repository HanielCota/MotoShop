import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const pageWidths = {
  default: "max-w-6xl",
  wide: "max-w-7xl",
  narrow: "max-w-3xl",
} as const;

export type PageWidth = keyof typeof pageWidths;

/**
 * Page container: centered column with the site gutters. `default` (6xl) is the storefront,
 * customer and seller width; `wide` (7xl) is the Admin; `narrow` (3xl) suits single forms.
 * Loading skeletons use the same width as the page they stand in for.
 */
export function pageContainerClassName(size: PageWidth = "default", className?: string) {
  return cn("mx-auto w-full px-4 sm:px-6", pageWidths[size], className);
}

type PageContainerProps = ComponentProps<"main"> & { size?: PageWidth };

export function PageContainer({ size, className, ...props }: PageContainerProps) {
  return <main className={pageContainerClassName(size, className)} {...props} />;
}
