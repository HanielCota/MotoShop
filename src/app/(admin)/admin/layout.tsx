import type { ReactNode } from "react";

import { requireAdminAccess } from "@/modules/auth/application/authorization";

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireAdminAccess();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="border-t-4 border-[#fe6900] bg-[#191918] px-6 py-7 text-white sm:px-8">
        <p className="text-moto-brand text-xs font-bold tracking-[0.16em] uppercase">
          O Marketplace de quem vive o OFF-ROAD!
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight uppercase sm:text-5xl">Admin do Moto Shop</h1>
        <p className="mt-2 text-sm text-white/70">Governança e operação do marketplace.</p>
      </div>
      {children}
    </main>
  );
}
