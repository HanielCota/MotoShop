"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Menu, Search, UserRound, X } from "lucide-react";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { Suspense, useRef, useState } from "react";

import { pageContainerClassName } from "@/components/ui/page-container";
import { popoverSurfaceClassName } from "@/components/ui/popover-surface";
import { cn } from "@/lib/utils";
import { MotoShopBrand } from "@/components/storefront/moto-shop-brand";
import { SignOutButton } from "@/modules/auth/components/sign-out-button";
import { authClient } from "@/modules/auth/infrastructure/auth-client";
import { CartPreview } from "@/modules/cart/components/cart-preview";
import { customerAccountLinks } from "@/modules/customers/account-links";
import { ProductSearchCombobox } from "@/modules/products/components/search/product-search-combobox";

import { isStorefrontPath, sellerLinkLabel } from "./storefront-routes";

const iconButtonClassName =
  "inline-flex size-11 items-center justify-center rounded-md text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-3 focus-visible:ring-moto-brand/60 focus-visible:outline-none";

export function StorefrontNavigation() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  if (!isStorefrontPath(pathname)) return null;

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
          <Link href="/seller" className="inline-flex min-h-11 items-center transition-colors hover:text-white">
            {sellerLinkLabel}
          </Link>
        </nav>

        <CatalogAwareHeaderSearch id="storefront-search" className="ml-auto hidden max-w-xs flex-1 md:flex" />

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <AccountMenu />
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
        <Link
          href="/seller"
          onClick={() => setMenuOpen(false)}
          className="flex min-h-11 items-center text-sm font-medium"
        >
          {sellerLinkLabel}
        </Link>
      </nav>
    </header>
  );
}

type HeaderSearchProps = { id: string; className?: string };

/**
 * The header search stays on the catalog too, so a new search happens where the last one started:
 * there it starts with the term searched,
 * so a customer can fix the search where they typed it. Reading the URL needs a Suspense boundary.
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
  const catalogQuery = pathname === "/products" ? (searchParams.get("q")?.trim() ?? "") : "";

  // key: a new search remounts the field with the new term instead of keeping the old text.
  return <HeaderSearch key={catalogQuery} {...props} defaultValue={catalogQuery} />;
}

function HeaderSearch({ id, className, defaultValue = "" }: HeaderSearchProps & { defaultValue?: string }) {
  return (
    <form action="/products" method="get" role="search" className={`relative items-center ${className ?? ""}`}>
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

function AccountMenu() {
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);

  if (!session?.user) {
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
              {session.user.name ? `Olá, ${session.user.name}` : "Minha conta"}
            </p>
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
