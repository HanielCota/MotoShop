import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { SectionHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

/** Cabeçalho das seções da homepage: `SectionHeader` com kicker e título em destaque. */
export function SectionHeading({
  kicker,
  title,
  titleId,
  link,
  className,
}: {
  kicker: string;
  title: string;
  titleId?: string;
  link: { label: string; href: Route };
  className?: string;
}) {
  return (
    <div className={cn("mb-6 space-y-2 sm:mb-8", className)}>
      <p className="eyebrow text-brand-strong">{kicker}</p>
      <SectionHeader
        className="[&_h2]:text-4xl [&_h2]:leading-[0.92] [&_h2]:uppercase sm:[&_h2]:text-5xl lg:[&_h2]:text-6xl"
        title={<span id={titleId}>{title}</span>}
        actions={
          <Link
            href={link.href}
            className="text-brand-strong inline-flex min-h-11 items-center gap-1.5 text-sm font-bold hover:underline"
          >
            {link.label} <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        }
      />
    </div>
  );
}
