import type { ReactNode } from "react";

import { CustomerAccountNavigation } from "./customer-account-navigation";

/** Shared frame of every customer-account page: account tabs, then the page content. */
export function CustomerAccountShell({ pathname, children }: { pathname: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <CustomerAccountNavigation pathname={pathname} />
        <div className="flex min-w-0 flex-col gap-8">{children}</div>
      </div>
    </main>
  );
}
