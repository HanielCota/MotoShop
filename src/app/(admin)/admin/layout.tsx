import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

import { AppAreaHeader } from "@/components/app-shell/app-area-header";
import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { AdminNavigation } from "@/modules/admin/components/admin-navigation";

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  // Defesa em profundidade: cada página do Admin também chama requireAdminAccess().
  await requireAdminAccess();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <AppAreaHeader area="Admin do Moto Shop" subtitle="Governança e operação do marketplace" icon={ShieldCheck} />
      <div className="grid min-w-0 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <AdminNavigation />
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}
