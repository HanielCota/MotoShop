import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SellerCta() {
  return (
    <section className="bg-moto-brand text-moto-brand-foreground py-14 sm:py-20" aria-labelledby="home-seller-title">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] uppercase">Para lojistas</p>
          <h2 id="home-seller-title" className="mt-2 text-4xl leading-[0.92] uppercase sm:text-5xl lg:text-6xl">
            Venda no Moto Shop
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 sm:text-base">
            Cadastre sua loja e gerencie catálogo, estoque e pedidos em um único painel.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <Link
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-moto-brand-foreground hover:bg-moto-brand-foreground/90 rounded-md px-5 font-bold text-white",
            )}
            href="/seller"
          >
            Cadastrar minha loja
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
