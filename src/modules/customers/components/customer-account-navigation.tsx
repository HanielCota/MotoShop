import Link from "next/link";

import { ScrollableTabs } from "@/components/ui/scrollable-tabs";
import { getCurrentSession } from "@/modules/auth/application/authorization";
import { SignOutButton } from "@/modules/auth/components/sign-out-button";

import { customerAccountLinks } from "../account-links";
import { customerGreeting } from "../domain/customer-greeting";

function isActive(href: string, pathname: string) {
  return href === "/orders" ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;
}

const itemClassName =
  "flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-base font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none lg:min-h-14 lg:rounded-none lg:border-l-4 lg:border-transparent lg:px-5";

/**
 * Menu "Serviços" da conta do cliente. No desktop é uma coluna com separadores;
 * no mobile vira abas roláveis que mantêm a aba atual visível. `userName` evita
 * buscar a sessão de novo quando a página já a carregou.
 */
export async function CustomerAccountNavigation({
  pathname,
  userName,
}: {
  pathname: string;
  userName?: string | null | undefined;
}) {
  const name = userName === undefined ? (await getCurrentSession())?.user.name : userName;

  return (
    <aside
      aria-labelledby="customer-account-services"
      className="border-border bg-card h-fit min-w-0 rounded-xl border lg:sticky lg:top-24 lg:overflow-hidden"
    >
      <div className="border-border flex flex-row-reverse items-baseline justify-between gap-3 px-4 pt-3 pb-1 lg:block lg:border-b lg:px-5 lg:py-4">
        <p id="customer-account-services" className="eyebrow text-muted-foreground lg:text-sm">
          Serviços
        </p>
        <p className="text-lg font-semibold lg:mt-1 lg:text-xl">{customerGreeting(name)}</p>
      </div>
      <ScrollableTabs
        aria-label="Serviços da minha conta"
        activeKey={pathname}
        fadeFromClassName="from-card"
        className="divide-border gap-1 p-2 lg:flex-col lg:gap-0 lg:divide-y lg:overflow-visible lg:p-0"
      >
        {customerAccountLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href, pathname) ? "page" : undefined}
            className={`${itemClassName} text-foreground hover:bg-muted aria-[current=page]:bg-moto-brand-surface aria-[current=page]:text-brand-strong lg:aria-[current=page]:border-moto-brand aria-[current=page]:font-semibold`}
          >
            <Icon aria-hidden="true" className="size-5 shrink-0" />
            {label}
          </Link>
        ))}
        <SignOutButton
          className={`${itemClassName} text-muted-foreground hover:bg-muted hover:text-foreground w-auto text-base lg:w-full lg:font-semibold [&_svg]:size-5`}
        />
      </ScrollableTabs>
    </aside>
  );
}
