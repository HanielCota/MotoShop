import Link from "next/link";
import type { Metadata } from "next";

import { buttonVariants } from "@/components/ui/button";
import { StatusPage } from "@/components/ui/status-page";
import { SearchForm } from "@/modules/products/components/search/search-form";

export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 sm:px-6">
      <StatusPage
        eyebrow="Erro 404"
        title="Página não encontrada"
        description="A página que você procura não existe ou foi removida. Busque um produto ou volte ao catálogo."
        actions={
          <>
            <Link href="/products" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Ver catálogo
            </Link>
            <Link href="/" className={buttonVariants({ variant: "ghost", size: "lg" })}>
              Página inicial
            </Link>
          </>
        }
      >
        <SearchForm
          action="/products"
          label="Buscar produtos"
          inputId="not-found-search"
          placeholder="Ex.: filtro de ar, pastilha de freio"
          inputClassName="bg-card"
          className="w-full flex-col gap-3 sm:flex-row"
        />
      </StatusPage>
    </main>
  );
}
