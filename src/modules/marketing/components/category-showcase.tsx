import { ArrowRight, Gauge } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { categoryCards, equipmentCategoryLabels, isCategoryHrefActive } from "../content/home-content";
import { SectionHeading } from "./section-heading";

export type MarketingCategory = { id: string; name: string; slug: string; parentId: string | null };

// No minimum height and content from the top: the cards have no photo, so extra height was empty space.
// Grid rows still give the cards of a row the same height.
const cardClassName =
  "group/category relative isolate flex overflow-hidden rounded-xl p-5 text-white before:absolute before:inset-y-0 before:left-0 before:-z-10 before:w-1.5 before:bg-moto-brand sm:p-6";
const iconClassName = "box-content size-6 shrink-0 rounded-md border border-white/25 p-1.5";
const eyebrowClassName = "text-xs font-bold tracking-[0.12em] text-white/65 uppercase";
const titleClassName = "mt-2.5 text-3xl leading-none uppercase sm:text-4xl";
// 44px touch target on phones and tablets; shorter rows on desktop so the links fit in two lines.
const equipmentLinkClassName =
  "inline-flex min-h-11 items-center gap-1 text-sm underline underline-offset-4 lg:min-h-7";

function CardHeading({ icon, eyebrow }: { icon: ReactNode; eyebrow: string }) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <span className={eyebrowClassName}>{eyebrow}</span>
    </div>
  );
}

export function CategoryShowcase({ categories }: { categories: MarketingCategory[] }) {
  const equipment = categories.find((category) => category.slug === "equipment");
  const equipmentCategories = equipment ? categories.filter((category) => category.parentId === equipment.id) : [];
  const cards = categoryCards.filter(({ href }) => isCategoryHrefActive(href, categories));

  return (
    <section
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 sm:py-20"
      id="categorias"
      aria-labelledby="home-categories-title"
    >
      <SectionHeading
        kicker="Catálogo"
        title="Categorias"
        titleId="home-categories-title"
        link={{ label: "Ver todas as categorias", href: "/products" }}
      />
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-[1.1fr_0.9fr_1.3fr]">
        {cards.map(({ title, description, eyebrow, href, icon: Icon }, index) => (
          <Link
            className={cn(cardClassName, index === 0 ? "bg-moto-brand-foreground" : "bg-foreground/85")}
            href={href}
            key={title}
          >
            <div className="w-full pr-8">
              <CardHeading
                icon={<Icon aria-hidden="true" className={cn(iconClassName, "text-moto-brand")} />}
                eyebrow={eyebrow}
              />
              <h3 className={titleClassName}>{title}</h3>
              <p className="mt-1 text-sm text-white/80">{description}</p>
            </div>
            <ArrowRight
              aria-hidden="true"
              className="absolute right-5 bottom-5 size-5 transition-transform group-hover/category:translate-x-1 motion-reduce:transition-none"
            />
          </Link>
        ))}
        {equipment ? (
          <article
            // Full width on tablets so its links fit in one line and the cards above need no extra height.
            className={cn(
              cardClassName,
              "bg-[color-mix(in_oklab,var(--moto-brand-strong)_45%,var(--foreground))] sm:col-span-2 lg:col-span-1",
            )}
          >
            <div className="w-full">
              <CardHeading
                icon={<Gauge aria-hidden="true" className={cn(iconClassName, "text-moto-brand-surface")} />}
                eyebrow="Pilotagem"
              />
              <h3 className={titleClassName}>Equipamentos</h3>
              <p className="mt-1 text-sm text-white/80">Escolha a categoria para explorar</p>
              <nav className="mt-2 flex flex-wrap gap-x-4" aria-label="Categorias de equipamentos">
                {equipmentCategories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/categoria/${encodeURIComponent(category.slug)}`}
                    className={equipmentLinkClassName}
                  >
                    {equipmentCategoryLabels[category.slug] ?? category.name}
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </Link>
                ))}
                <Link href={`/categoria/${encodeURIComponent(equipment.slug)}`} className={equipmentLinkClassName}>
                  Outros equipamentos
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              </nav>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
