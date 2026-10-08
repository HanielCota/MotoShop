import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { essentials, isCategoryHrefActive } from "../content/home-content";
import { SectionHeading } from "./section-heading";

export function EssentialsSection({ categories }: { categories: { slug: string }[] }) {
  return (
    <section className="bg-card py-14 sm:py-20" aria-labelledby="home-essentials-title">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <SectionHeading
          kicker="Itens de recorrência"
          title="O essencial para continuar rodando"
          titleId="home-essentials-title"
          link={{ label: "Explorar catálogo", href: "/products" }}
        />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {essentials
            .filter(({ href }) => isCategoryHrefActive(href, categories))
            .map(({ title, description, icon: Icon, href }) => (
              <Link
                className="group/essential border-border bg-background hover:bg-secondary flex flex-col rounded-xl border p-4 transition-colors sm:p-5"
                href={href}
                key={title}
              >
                <span className="bg-moto-brand-foreground grid size-11 place-items-center rounded-md text-white">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <h3 className="mt-4 font-sans text-sm font-semibold tracking-normal sm:text-base">{title}</h3>
                <p className="text-muted-foreground mt-1 text-xs leading-5 sm:text-sm">{description}</p>
                <span className="text-brand-strong mt-auto inline-flex items-center gap-1.5 pt-3 text-xs font-bold sm:text-sm">
                  Ver produtos
                  <ArrowRight
                    aria-hidden="true"
                    className="size-3.5 transition-transform group-hover/essential:translate-x-0.5 motion-reduce:transition-none"
                  />
                </span>
              </Link>
            ))}
        </div>
      </div>
    </section>
  );
}
