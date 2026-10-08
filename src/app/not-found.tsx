import Link from "next/link";
import { Search } from "lucide-react";
import type { Metadata } from "next";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-start gap-6 px-4 py-16 sm:py-24">
      <div className="space-y-3">
        <p className="text-brand-strong text-xs font-semibold tracking-[0.14em] uppercase">Erro 404</p>
        <h1 className="text-4xl text-balance sm:text-5xl">Saímos da trilha</h1>
        <p className="text-muted-foreground max-w-xl">
          A página que você procura não existe, foi removida ou o produto não está mais disponível. Busque uma peça ou
          volte ao catálogo do Moto Shop.
        </p>
      </div>

      <form action="/products" method="get" role="search" className="flex w-full flex-col gap-3 sm:flex-row">
        <label htmlFor="not-found-search" className="sr-only">
          Buscar produtos
        </label>
        <Input
          id="not-found-search"
          name="q"
          type="search"
          placeholder="Ex.: filtro de ar, pastilha de freio"
          className="bg-card h-11 flex-1"
        />
        <Button type="submit" size="lg" className="px-5">
          <Search aria-hidden="true" />
          Buscar
        </Button>
      </form>

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
