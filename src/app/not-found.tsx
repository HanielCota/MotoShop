import Image from "next/image";
import Link from "next/link";
import type { Metadata, Route } from "next";
import { Grid2x2, House, Motorbike, type LucideIcon } from "lucide-react";

import { pageContainerClassName } from "@/components/ui/page-container";
import { SearchForm } from "@/modules/products/components/search/search-form";
import { domainIcons } from "@/shared/presentation/domain-icons";

export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: false },
};

type QuickPath = { href: Route; title: string; description: string; icon: LucideIcon };

const quickPaths: readonly QuickPath[] = [
  {
    href: "/products",
    title: "Catálogo completo",
    description: "Todas as peças, equipamentos e acessórios",
    icon: Grid2x2,
  },
  {
    href: "/#minha-moto" as Route,
    title: "Peças para minha moto",
    description: "Escolha a moto e veja o que serve",
    icon: Motorbike,
  },
  { href: "/orders", title: "Meus pedidos", description: "Acompanhe uma compra", icon: domainIcons.order },
  { href: "/", title: "Página inicial", description: "Voltar ao começo", icon: House },
];

export default function NotFound() {
  return (
    <main className="bg-surface-sunken flex flex-col">
      <section
        className="bg-moto-brand-foreground relative isolate overflow-hidden text-white"
        aria-labelledby="not-found-title"
      >
        <Image
          src="/images/marketing/motoshop-hero.webp"
          alt=""
          fill
          sizes="100vw"
          className="-z-10 object-cover opacity-30"
        />
        <div
          aria-hidden="true"
          className="from-moto-brand-foreground to-moto-brand-foreground/40 absolute inset-0 -z-10 bg-linear-to-r from-35%"
        />
        <div className={pageContainerClassName("default", "py-12 sm:py-14")}>
          <p className="eyebrow text-moto-brand">Erro 404</p>
          <p
            aria-hidden="true"
            className="font-heading text-moto-brand mt-2 text-7xl leading-[0.9] font-extrabold sm:text-9xl"
          >
            404
          </p>
          {/* The hidden words keep the page named for screen readers and for the tests that look for it. */}
          <h1 id="not-found-title" className="mt-1 text-3xl uppercase sm:text-5xl">
            <span className="sr-only">Página não encontrada: </span>
            Saiu da trilha
          </h1>
          <p className="mt-3 max-w-xl text-white/80">
            Não achamos esta página. O link pode estar errado ou o produto não está mais à venda. Busque a peça ou
            escolha um caminho abaixo.
          </p>
          <SearchForm
            action="/products"
            label="Buscar produtos"
            inputId="not-found-search"
            placeholder="Ex.: filtro de ar, pastilha de freio"
            inputClassName="bg-card text-foreground"
            className="mt-5 w-full max-w-xl flex-col gap-3 sm:flex-row"
          />
        </div>
      </section>
      <section aria-labelledby="quick-paths-title" className={pageContainerClassName("default", "py-8 sm:py-12")}>
        <h2 id="quick-paths-title" className="text-xl uppercase">
          Caminhos rápidos
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickPaths.map(({ href, title, description, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="bg-card ring-foreground/10 hover:ring-foreground/25 focus-visible:ring-ring flex h-full gap-3 rounded-xl p-4 ring-1 transition-shadow"
              >
                <span className="bg-moto-brand-surface text-brand-strong grid size-10 shrink-0 place-items-center rounded-lg">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="text-muted-foreground mt-0.5 block text-sm">{description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
