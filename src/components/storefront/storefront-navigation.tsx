"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Menu,
  Search,
  ShieldCheck,
  Store,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { Suspense, useRef, useState } from "react";

import { pageContainerClassName } from "@/components/ui/page-container";
import { popoverSurfaceClassName } from "@/components/ui/popover-surface";
import { cn } from "@/lib/utils";
import { MotoShopBrand } from "@/components/storefront/moto-shop-brand";
import { SignOutButton } from "@/modules/auth/components/sign-out-button";
import { useAccountAreaAccess } from "@/modules/auth/components/use-account-area-access";
import { useFirstSessionCheckDone } from "@/modules/auth/components/use-first-session-check-done";
import {
  accountAreaShortcuts,
  noAccountAreaAccess,
  type AccountAreaShortcut,
} from "@/modules/auth/domain/account-area-shortcuts";
import { authClient } from "@/modules/auth/infrastructure/auth-client";
import { CartPreview } from "@/modules/cart/components/cart-preview";
import { customerAccountLinks } from "@/modules/customers/account-links";
import { ProductSearchCombobox } from "@/modules/products/components/search/product-search-combobox";

import { isStorefrontPath, sellerLinkLabel } from "./storefront-routes";

const iconButtonClassName =
  "inline-flex size-11 items-center justify-center rounded-md text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-3 focus-visible:ring-moto-brand/60 focus-visible:outline-none";

export function StorefrontNavigation() {
  const pathname = usePathname();

  if (!isStorefrontPath(pathname)) return null;

  return <StorefrontHeader pathname={pathname} />;
}

/** Mounted only on storefront pages, so the Admin and the Central do Lojista never ask for area access here. */
function StorefrontHeader({ pathname }: { pathname: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const sessionKnown = useFirstSessionCheckDone(sessionPending);
  const access = useAccountAreaAccess(session?.user.id);
  const shortcuts = accountAreaShortcuts(access ?? noAccountAreaAccess);
  // Until the session and the area access are known, the link keeps its place but shows nothing,
  // so a store owner never sees "Venda no Moto Shop" flash before "Central do Lojista".
  const areaLinkClassName = sessionKnown === false || access == null ? "invisible" : "";
  const catalogActive = pathname === "/products" || pathname.startsWith("/products/");

  return (
    <header
      className="bg-moto-brand-foreground z-header sticky top-0 border-b border-white/10 text-white shadow-sm"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !menuOpen) return;
        setMenuOpen(false);
        menuButton.current?.focus();
      }}
    >
      <div className={pageContainerClassName("default", "flex min-h-[68px] items-center gap-3")}>
        <MotoShopBrand />

        <nav
          className="ml-4 hidden items-center gap-6 text-sm font-medium text-white/75 md:flex lg:ml-6"
          aria-label="Navegação principal"
        >
          <Link
            href="/products"
            aria-current={catalogActive ? "page" : undefined}
            className="aria-[current=page]:text-moto-brand inline-flex min-h-11 items-center transition-colors hover:text-white"
          >
            Catálogo
          </Link>
          <AreaLinks
            shortcuts={shortcuts}
            onNavigate={() => setMenuOpen(false)}
            className={`inline-flex min-h-11 items-center transition-colors hover:text-white ${areaLinkClassName}`}
          />
        </nav>

        <CatalogAwareHeaderSearch id="storefront-search" className="ml-auto hidden max-w-xs flex-1 md:flex" />

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <AccountMenu signedInName={signedInNameOf(session)} shortcuts={shortcuts} sessionKnown={sessionKnown} />
          <CartPreview />
          <button
            ref={menuButton}
            type="button"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            aria-controls="storefront-mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
            className={`${iconButtonClassName} md:hidden`}
          >
            {menuOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
          </button>
        </div>
      </div>

      <nav
        id="storefront-mobile-navigation"
        aria-label="Navegação mobile"
        className="bg-moto-brand-foreground border-t border-white/10 px-4 py-2 md:hidden"
        hidden={!menuOpen}
      >
        <CatalogAwareHeaderSearch id="storefront-mobile-search" className="my-2 flex" />
        {shortcuts.length > 0 ? (
          <AreaLinks
            shortcuts={shortcuts}
            onNavigate={() => setMenuOpen(false)}
            className="text-moto-brand flex min-h-11 items-center border-b border-white/10 text-sm font-semibold"
          />
        ) : null}
        <Link
          href="/products"
          onClick={() => setMenuOpen(false)}
          className="flex min-h-11 items-center border-b border-white/10 text-sm font-medium"
        >
          Catálogo
        </Link>
        <Link
          href="/#minha-moto"
          onClick={() => setMenuOpen(false)}
          className="flex min-h-11 items-center border-b border-white/10 text-sm font-medium"
        >
          Peças para minha moto
        </Link>
        <Link
          href="/#categorias"
          onClick={() => setMenuOpen(false)}
          className="flex min-h-11 items-center border-b border-white/10 text-sm font-medium"
        >
          Categorias
        </Link>
        {shortcuts.length === 0 ? (
          <AreaLinks
            shortcuts={shortcuts}
            onNavigate={() => setMenuOpen(false)}
            className="flex min-h-11 items-center text-sm font-medium"
          />
        ) : null}
      </nav>
    </header>
  );
}

type HeaderSearchProps = { id: string; className?: string };

/**
 * The header search stays on the catalog too, filled with the term searched there and keeping the
 * filters already applied, like the catalog search band. Reading the URL needs a Suspense boundary.
 */
function CatalogAwareHeaderSearch(props: HeaderSearchProps) {
  return (
    <Suspense fallback={<HeaderSearch {...props} />}>
      <HeaderSearchWithCatalogQuery {...props} />
    </Suspense>
  );
}

function HeaderSearchWithCatalogQuery(props: HeaderSearchProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (pathname !== "/products") return <HeaderSearch {...props} />;

  const catalogQuery = searchParams.get("q")?.trim() ?? "";
  // A new search starts on the first page; the term itself comes from the field.
  const preservedEntries = [...searchParams.entries()].filter(([name]) => name !== "q" && name !== "page");

  // key: a new search remounts the field with the new term instead of keeping the old text.
  return <HeaderSearch key={catalogQuery} {...props} defaultValue={catalogQuery} preservedEntries={preservedEntries} />;
}

function HeaderSearch({
  id,
  className,
  defaultValue = "",
  preservedEntries = [],
}: HeaderSearchProps & { defaultValue?: string; preservedEntries?: readonly [string, string][] }) {
  return (
    <form action="/products" method="get" role="search" className={`relative items-center ${className ?? ""}`}>
      {preservedEntries.map(([name, value]) => (
        <input key={`${name}=${value}`} type="hidden" name={name} value={value} />
      ))}
      <label htmlFor={id} className="sr-only">
        Buscar produtos
      </label>
      <ProductSearchCombobox
        id={id}
        variant="plain"
        defaultValue={defaultValue}
        className="w-full"
        listClassName="sm:w-80"
        placeholder="Buscar peças, marcas ou lojas"
        inputClassName="focus-visible:border-moto-brand focus-visible:ring-moto-brand/40 h-11 w-full rounded-md border border-white/20 bg-white/10 pr-11 pl-3 text-base text-white placeholder:text-white/55 focus-visible:ring-3 focus-visible:outline-none md:text-sm"
      />
      <button
        type="submit"
        aria-label="Buscar"
        className="focus-visible:ring-moto-brand/60 absolute right-0 inline-flex size-11 items-center justify-center rounded-md text-white/80 hover:text-white focus-visible:ring-3 focus-visible:outline-none"
      >
        <Search aria-hidden="true" className="size-4" />
      </button>
    </form>
  );
}

const accountMenuItemClassName =
  "data-[highlighted]:bg-muted flex min-h-10 w-full items-center rounded-md px-3 text-sm font-medium outline-none";

/**
 * Whoever can open the Central do Lojista or the Admin sees those areas by name; everyone else is
 * invited to sell. "Venda no Moto Shop" alone made store owners think it was the sign-up page.
 */
function AreaLinks({
  shortcuts,
  className,
  onNavigate,
}: {
  shortcuts: readonly AccountAreaShortcut[];
  className: string;
  onNavigate: () => void;
}) {
  if (shortcuts.length === 0) {
    return (
      <Link href="/seller" onClick={onNavigate} className={className}>
        {sellerLinkLabel}
      </Link>
    );
  }

  return shortcuts.map((shortcut) => (
    <Link key={shortcut.href} href={shortcut.href} onClick={onNavigate} className={className}>
      {shortcut.label}
    </Link>
  ));
}

/** Null for visitors; "" for a signed-in account without a name. */
function signedInNameOf(session: { user: { name?: string | null } } | null | undefined): string | null {
  if (session?.user == null) return null;

  return session.user.name ?? "";
}

/** `signedInName` is null for visitors and "" for a signed-in account without a name. */
function AccountMenu({
  signedInName,
  shortcuts,
  sessionKnown,
}: {
  signedInName: string | null;
  shortcuts: readonly AccountAreaShortcut[];
  sessionKnown: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Keep the account slot stable until the initial session check finishes.
  if (sessionKnown === false) return <span aria-hidden="true" className="inline-flex size-11" />;

  if (signedInName == null) {
    return (
      <Link href="/login" aria-label="Entrar na minha conta" className={iconButtonClassName}>
        <UserRound aria-hidden="true" className="size-5" />
      </Link>
    );
  }

  return (
    <BaseMenu.Root open={open} onOpenChange={setOpen} modal={false}>
      <BaseMenu.Trigger aria-label="Minha conta" className={`${iconButtonClassName} w-auto gap-0.5 px-2`}>
        <UserRound aria-hidden="true" className="size-5" />
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </BaseMenu.Trigger>
      <BaseMenu.Portal>
        <BaseMenu.Positioner side="bottom" align="end" sideOffset={8} className="z-popover">
          <BaseMenu.Popup className={cn(popoverSurfaceClassName, "w-56 p-1.5 outline-none")}>
            <p className="text-muted-foreground truncate px-3 pt-1.5 pb-2 text-xs">
              {signedInName === "" ? "Minha conta" : `Olá, ${signedInName}`}
            </p>
            {shortcuts.length > 0 ? (
              <>
                {shortcuts.map((shortcut) => (
                  <BaseMenu.LinkItem
                    key={shortcut.href}
                    closeOnClick
                    render={<Link href={shortcut.href} />}
                    className={cn(accountMenuItemClassName, "gap-2.5 font-semibold")}
                  >
                    <AreaShortcutIcon area={shortcut.area} />
                    {shortcut.label}
                    <ChevronRight aria-hidden="true" className="text-muted-foreground ml-auto size-4" />
                  </BaseMenu.LinkItem>
                ))}
                <BaseMenu.Separator className="border-border my-1.5 border-t" />
              </>
            ) : null}
            {customerAccountLinks.map((link) => (
              <BaseMenu.LinkItem
                key={link.href}
                closeOnClick
                render={<Link href={link.href} />}
                className={accountMenuItemClassName}
              >
                {link.label}
              </BaseMenu.LinkItem>
            ))}
            <BaseMenu.Separator className="border-border my-1.5 border-t" />
            <BaseMenu.Item
              closeOnClick={false}
              nativeButton
              render={<SignOutButton onSignedOut={() => setOpen(false)} />}
              className={accountMenuItemClassName}
            />
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

const areaShortcutIcons: Readonly<Record<AccountAreaShortcut["area"], LucideIcon>> = {
  admin: ShieldCheck,
  seller: Store,
};

function AreaShortcutIcon({ area }: { area: AccountAreaShortcut["area"] }) {
  const Icon = areaShortcutIcons[area];

  return <Icon aria-hidden="true" className="size-4 shrink-0" />;
}
