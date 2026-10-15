import Link from "next/link";
import type { Metadata } from "next";

import { buttonVariants } from "@/components/ui/button";
import { SearchForm } from "@/modules/products/components/search/search-form";

export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-start gap-6 px-4 py-16 sm:py-24">
      <div className="space-y-3">
        <p className="text-brand-strong text-xs font-semibold tracking-[0.14em] uppercase">Erro 404</p>
        <h1 className="text-4xl text-balance sm:text-5xl">Página não encontrada</h1>
        <p className="text-muted-foreground max-w-xl">
          A página que você procura não existe ou foi removida. Busque um produto ou volte ao catálogo.
        </p>
      </div>

      <SearchForm
        action="/products"
        label="Buscar produtos"
        inputId="not-found-search"
        placeholder="Ex.: filtro de ar, pastilha de freio"
        inputClassName="bg-card"
        className="w-full flex-col gap-3 sm:flex-row"
      />

      <div className="flex flex-wrap gap-3">
        <Link href="/products" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Ver catálogo
        </Link>
        <Link href="/" className={buttonVariants({ variant: "ghost", size: "lg" })}>
          Página inicial
        </Link>
      </div>
    </main>
  );
}
