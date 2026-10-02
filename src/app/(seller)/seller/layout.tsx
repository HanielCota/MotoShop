import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { SellerNavigation } from "@/modules/sellers/components/seller-navigation";

export default async function SellerLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireAuthenticatedUser("/seller");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="relative isolate overflow-hidden border-t-4 border-[#fe6900] bg-[#191918] px-6 py-8 text-white sm:px-9 sm:py-9">
        <div
          className="absolute top-0 right-0 -z-10 h-full w-1/3 border-l border-white/10 bg-white/[0.025]"
          aria-hidden="true"
        />
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-moto-brand text-xs font-bold tracking-[0.18em] uppercase">
              O Marketplace de quem vive o OFF-ROAD!
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight uppercase sm:text-5xl">Central do Lojista</h1>
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
