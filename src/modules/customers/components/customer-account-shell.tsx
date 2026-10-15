import type { ReactNode } from "react";

import { CustomerAccountNavigation } from "./customer-account-navigation";
import { pageContainerClassName } from "@/components/ui/page-container";

/** Shared frame of every customer-account page: "Serviços" navigation, then the page content. */
export function CustomerAccountShell({
  pathname,
  userName,
  children,
}: {
  pathname: string;
  /** Nome do usuário já carregado pela página (saudação "Olá, {primeiro nome}"). */
  userName?: string | null | undefined;
  children: ReactNode;
}) {
  return (
    <main className={pageContainerClassName("default", "py-10")}>
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
        <CustomerAccountNavigation pathname={pathname} userName={userName} />
        <div className="flex min-w-0 flex-col gap-8">{children}</div>
      </div>
    </main>
  );
}
