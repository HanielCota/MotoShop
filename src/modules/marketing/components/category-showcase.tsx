import { ArrowRight, Gauge } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import {
  categoryCards,
  equipmentCardImage,
  equipmentCategoryLabels,
  isCategoryHrefActive,
} from "../content/home-content";
import { SectionHeading } from "./section-heading";
import { pageContainerClassName } from "@/components/ui/page-container";

export type MarketingCategory = { id: string; name: string; slug: string; parentId: string | null };

// No minimum height and content from the top; grid rows still give the cards of a row the same height.
// Each card sets its color in --card: the background and the frosted glass over the product photo use it.
// The orange stripe stays above the glass.
const cardClassName =
  "group/category relative isolate flex overflow-hidden rounded-xl bg-(--card) p-5 text-white before:absolute before:inset-y-0 before:left-0 before:z-20 before:w-1.5 before:bg-moto-brand sm:p-6";
const cardColors = [
  "[--card:var(--moto-brand-foreground)]",
  "[--card:color-mix(in_srgb,var(--foreground)_85%,transparent)]",
];
const equipmentCardColor = "[--card:color-mix(in_oklab,var(--moto-brand-strong)_45%,var(--foreground))]";
const iconClassName = "box-content size-6 shrink-0 rounded-md border border-white/25 p-1.5";
const eyebrowClassName = "text-xs font-bold tracking-[0.12em] text-white/65 uppercase";
const titleClassName = "mt-2.5 text-3xl leading-none uppercase sm:text-4xl";
// 44px touch target on phones and tablets; shorter rows on desktop so the links fit in two lines.
const equipmentLinkClassName =
  "inline-flex min-h-11 items-center gap-1 text-sm underline underline-offset-4 lg:min-h-7";

/** Product cutout, more to the center and bleeding off the bottom edge, seen through a light frosted glass. */
function CardPhoto({ src }: { src: string }) {
  return (
    <>
      <Image
        src={src}
        alt=""
        aria-hidden="true"
        width={640}
        height={640}
        sizes="(min-width: 1024px) 260px, (min-width: 640px) 58vw, 40vw"
        // Phones: smaller and further right, so the long eyebrow and title stay over the plain glass.
        className="pointer-events-none absolute -right-[6%] -bottom-8 z-0 h-auto w-[40%] max-w-[260px] select-none sm:right-[4%] sm:-bottom-6 sm:w-[58%]"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 z-10 bg-[color-mix(in_srgb,var(--card)_42%,transparent)] backdrop-blur-[2.5px]"
      />
    </>
  );
}

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
      className={pageContainerClassName("default", "scroll-mt-20 py-14 sm:py-20")}
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
        {cards.map(({ title, description, eyebrow, href, icon: Icon, image }, index) => (
          <Link className={cn(cardClassName, cardColors[index] ?? cardColors[1])} href={href} key={title}>
            <CardPhoto src={image} />
            <div className="relative z-20 w-full pr-8">
              <CardHeading
                icon={<Icon aria-hidden="true" className={cn(iconClassName, "text-moto-brand")} />}
                eyebrow={eyebrow}
              />
              <h3 className={titleClassName}>{title}</h3>
              <p className="mt-1 text-sm text-white/80">{description}</p>
            </div>
            <ArrowRight
              aria-hidden="true"
              className="absolute right-5 bottom-5 z-20 size-5 transition-transform group-hover/category:translate-x-1 motion-reduce:transition-none"
            />
          </Link>
        ))}
        {equipment ? (
          <article
            // Full width on tablets so its links fit in one line and the cards above need no extra height.
            className={cn(cardClassName, equipmentCardColor, "sm:col-span-2 lg:col-span-1")}
          >
            <CardPhoto src={equipmentCardImage} />
            <div className="relative z-20 w-full">
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
