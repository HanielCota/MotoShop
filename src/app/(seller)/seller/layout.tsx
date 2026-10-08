import type { ReactNode } from "react";
import { Store } from "lucide-react";

import { AppAreaHeader } from "@/components/app-shell/app-area-header";
import { getSellerDashboardContext } from "@/modules/sellers/application/get-seller-dashboard-context";
import { SellerNavigation } from "@/modules/sellers/components/seller-navigation";

export default async function SellerLayout({ children }: Readonly<{ children: ReactNode }>) {
  const context = await getSellerDashboardContext();
  const storeName = context.status === "no-seller" ? null : (context.seller.store?.name ?? null);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <AppAreaHeader area="Central do Lojista" subtitle={storeName} icon={Store} />
      {context.status === "ready" && context.seller.store ? (
        <SellerNavigation permissions={context.permissions} />
      ) : null}
      {children}
    </main>
  );
}
