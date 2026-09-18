import type { ReactNode } from "react";

import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";

export default async function SellerLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireAuthenticatedUser("/seller");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm font-medium">Central do Lojista</p>
        <h1 className="text-3xl font-semibold tracking-tight">Operação da loja</h1>
      </div>
      {children}
    </main>
  );
}
