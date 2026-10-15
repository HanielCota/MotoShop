import Link from "next/link";

import { pageContainerClassName } from "@/components/ui/page-container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SellerCta() {
  return (
    <section className="bg-moto-brand text-moto-brand-foreground py-14 sm:py-20" aria-labelledby="home-seller-title">
      <div className={pageContainerClassName("default", "grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center")}>
        <div>
          <p className="text-xs font-bold tracking-[0.16em] uppercase">Para lojas especializadas</p>
          <h2 id="home-seller-title" className="mt-2 text-4xl leading-[0.92] uppercase sm:text-5xl lg:text-6xl">
            Sua loja na pista certa.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 sm:text-base">
            Venda para um público que já procura motocross. Controle catálogo, estoque, pedidos e equipe em um único
            painel.
          </p>
        </div>
        {/* Single-column grid: both buttons take the width of the wider one. */}
        <div className="grid w-full gap-3 sm:w-fit lg:justify-self-end">
          <Link
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-moto-brand-foreground hover:bg-moto-brand-foreground/90 rounded-md px-5 font-bold text-white",
            )}
            href="/seller"
          >
            Quero vender no Moto Shop
          </Link>
          <Link
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "border-moto-brand-foreground/50 hover:bg-moto-brand-foreground/10 text-moto-brand-foreground rounded-md bg-transparent px-5 font-bold",
            )}
            href="/login"
          >
            Já tenho uma conta
          </Link>
        </div>
      </div>
    </section>
  );
}
