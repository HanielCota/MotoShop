import { ArrowRight, Gauge } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { categoryCards, equipmentCategoryLabels, isCategoryHrefActive } from "../content/home-content";
import { SectionHeading } from "./section-heading";

export type MarketingCategory = { id: string; name: string; slug: string; parentId: string | null };

const cardClassName =
  "group/category relative isolate flex min-h-52 overflow-hidden rounded-xl p-5 text-white before:absolute before:inset-y-0 before:left-0 before:-z-10 before:w-1.5 before:bg-moto-brand sm:min-h-60 sm:p-6";
const iconClassName =
  "absolute top-5 left-5 box-content size-6 rounded-md border border-white/25 p-1.5 sm:top-6 sm:left-6";
const eyebrowClassName = "text-xs font-bold tracking-[0.12em] text-white/65 uppercase";
const titleClassName = "mt-1.5 text-3xl leading-none uppercase sm:text-4xl";

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
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-[1.28fr_1fr_1fr]">
        {cards.map(({ title, description, eyebrow, href, icon: Icon }, index) => (
          <Link
            className={cn(
              cardClassName,
              index === 0 ? "bg-moto-brand-foreground sm:col-span-2 lg:col-span-1" : "bg-foreground/85",
            )}
            href={href}
            key={title}
          >
            <Icon aria-hidden="true" className={cn(iconClassName, "text-moto-brand")} />
            <div className="mt-auto w-full pt-14 pr-8">
              <span className={eyebrowClassName}>{eyebrow}</span>
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
            className={cn(cardClassName, "bg-[color-mix(in_oklab,var(--moto-brand-strong)_45%,var(--foreground))]")}
          >
            <Gauge aria-hidden="true" className={cn(iconClassName, "text-moto-brand-surface")} />
            <div className="mt-auto w-full pt-14">
              <span className={eyebrowClassName}>Pilotagem</span>
              <h3 className={titleClassName}>Equipamentos</h3>
              <p className="mt-1 text-sm text-white/80">Escolha a categoria para explorar</p>
              <nav className="mt-2 flex flex-wrap gap-x-4" aria-label="Categorias de equipamentos">
                {equipmentCategories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/categoria/${encodeURIComponent(category.slug)}`}
                    className="inline-flex min-h-11 items-center gap-1 text-sm underline underline-offset-4"
                  >
                    {equipmentCategoryLabels[category.slug] ?? category.name}
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </Link>
                ))}
                <Link
                  href={`/categoria/${encodeURIComponent(equipment.slug)}`}
                  className="inline-flex min-h-11 items-center gap-1 text-sm underline underline-offset-4"
                >
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
