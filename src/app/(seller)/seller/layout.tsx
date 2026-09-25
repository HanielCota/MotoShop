import type { ReactNode } from "react";
import Link from "next/link";

import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";

export default async function SellerLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireAuthenticatedUser("/seller");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm font-medium">Central do Lojista</p>
        <h1 className="text-3xl font-semibold tracking-tight">Central da loja</h1>
      </div>
      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Navegação da Central do Lojista">
        <Link href="/seller" className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-orange-200 bg-orange-50 px-4 text-sm font-semibold text-orange-900">
          Visão geral
        </Link>
        <Link href="/seller/orders" className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:border-orange-300 hover:text-orange-800">
          Pedidos
        </Link>
        <Link href="/seller/questions" className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:border-orange-300 hover:text-orange-800">
          Perguntas
        </Link>
        <Link href="/seller/shipping" className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:border-orange-300 hover:text-orange-800">
          Frete próprio
        </Link>
      </nav>
      {children}
    </main>
  );
}
