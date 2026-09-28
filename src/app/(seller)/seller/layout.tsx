import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { SellerNavigation } from "@/modules/sellers/components/seller-navigation";

export default async function SellerLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireAuthenticatedUser("/seller");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="relative isolate overflow-hidden rounded-[1.5rem] bg-[#191918] px-6 py-8 text-white sm:px-9 sm:py-9">
        <div
          className="absolute -top-24 -right-16 -z-10 size-72 rounded-full border-[36px] border-[#ed5a17]/20"
          aria-hidden="true"
        />
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-[#ff8b53] uppercase">Central do Lojista</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Central da loja</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">
              Catálogo, pedidos e operação da sua loja em um só lugar.
            </p>
          </div>
          <Link
            href="/products"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/25 px-3 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white"
          >
            Ver marketplace <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </header>
      <SellerNavigation />
      {children}
    </main>
  );
}
