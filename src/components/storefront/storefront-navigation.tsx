"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, Search, UserRound, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { MotoShopBrand } from "@/components/storefront/moto-shop-brand";
import { SignOutButton } from "@/modules/auth/components/sign-out-button";
import { authClient } from "@/modules/auth/infrastructure/auth-client";
import { CartPreview } from "@/modules/cart/components/cart-preview";
import { ProductSearchCombobox } from "@/modules/products/components/search/product-search-combobox";

import { isStorefrontPath, sellerLinkLabel } from "./storefront-routes";

/** Atalhos da área do cliente exibidos no menu da conta. */
export const accountLinks = [
  { href: "/orders", label: "Meus pedidos" },
  { href: "/favorites", label: "Favoritos" },
  { href: "/account/profile", label: "Dados cadastrais" },
  { href: "/account/password", label: "Redefinir senha" },
  { href: "/account/addresses", label: "Meus endereços" },
] as const;

const iconButtonClassName =
  "inline-flex size-11 items-center justify-center rounded-md text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-3 focus-visible:ring-moto-brand/60 focus-visible:outline-none";

export function StorefrontNavigation() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  if (!isStorefrontPath(pathname)) return null;

  const catalogActive = pathname === "/products" || pathname.startsWith("/products/");
  // The catalog has its own search band above the results; avoid two competing fields there.
  const showHeaderSearch = pathname !== "/products";

  return (
    <header
      className="bg-moto-brand-foreground sticky top-0 z-50 border-b border-white/10 text-white shadow-sm"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !menuOpen) return;
        setMenuOpen(false);
        menuButton.current?.focus();
      }}
    >
      <div className="mx-auto flex min-h-[68px] w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
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

        {showHeaderSearch ? (
          <HeaderSearch id="storefront-search" className="ml-auto hidden max-w-xs flex-1 md:flex" />
        ) : null}

        <div className={`flex items-center gap-1 ${showHeaderSearch ? "ml-auto md:ml-0" : "ml-auto"}`}>
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
        {showHeaderSearch ? <HeaderSearch id="storefront-mobile-search" className="my-2 flex" /> : null}
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

function HeaderSearch({ id, className }: { id: string; className?: string }) {
  return (
    <form action="/products" method="get" role="search" className={`relative items-center ${className ?? ""}`}>
      <label htmlFor={id} className="sr-only">
        Buscar produtos
      </label>
      <ProductSearchCombobox
        id={id}
        variant="plain"
        className="w-full"
        listClassName="sm:w-80"
        placeholder="Buscar peças, marcas ou lojas"
        inputClassName="focus-visible:border-moto-brand focus-visible:ring-moto-brand/40 h-11 w-full rounded-md border border-white/20 bg-white/10 pr-11 pl-3 text-base text-white placeholder:text-white/55 focus-visible:ring-3 focus-visible:outline-none md:h-10 md:text-sm"
      />
      <button
        type="submit"
        aria-label="Buscar"
        className="focus-visible:ring-moto-brand/60 absolute right-0 inline-flex size-10 items-center justify-center rounded-md text-white/80 hover:text-white focus-visible:ring-3 focus-visible:outline-none"
      >
        <Search aria-hidden="true" className="size-4" />
      </button>
    </form>
  );
}

function AccountMenu() {
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  if (!session?.user) {
    return (
      <Link href="/login" aria-label="Entrar na minha conta" className={iconButtonClassName}>
        <UserRound aria-hidden="true" className="size-5" />
      </Link>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label="Minha conta"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className={`${iconButtonClassName} w-auto gap-0.5 px-2`}
      >
        <UserRound aria-hidden="true" className="size-5" />
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </button>
      <div
        id={menuId}
        hidden={!open}
        className="bg-popover text-popover-foreground border-border absolute right-0 z-50 mt-2 w-56 rounded-xl border p-1.5 shadow-lg"
      >
        <p className="text-muted-foreground truncate px-3 pt-1.5 pb-2 text-xs">
          {session.user.name ? `Olá, ${session.user.name}` : "Minha conta"}
        </p>
        <ul aria-label="Minha conta">
          {accountLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setOpen(false)}
                className="hover:bg-muted focus-visible:bg-muted flex min-h-10 items-center rounded-md px-3 text-sm font-medium focus-visible:outline-none"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="border-border mt-1.5 border-t pt-1.5">
          <SignOutButton
            onSignedOut={() => setOpen(false)}
            className="hover:bg-muted focus-visible:bg-muted w-full focus-visible:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
