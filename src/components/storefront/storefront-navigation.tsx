"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, UserRound, X } from "lucide-react";
import { useRef, useState } from "react";
import { MotoShopBrand } from "@/components/storefront/moto-shop-brand";
import { authClient } from "@/modules/auth/infrastructure/auth-client";
import { CartPreview } from "@/modules/cart/components/cart-preview";

export function StorefrontNavigation() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  if (!pathname || pathname === "/" || /^\/(admin|api|seller)(\/|$)/.test(pathname)) return null;

  const catalogActive = pathname === "/products" || pathname.startsWith("/products/");

  return (
    <header
      className="sticky top-0 z-50 border-b border-white/10 bg-[#171716] text-white shadow-sm"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !menuOpen) return;
        setMenuOpen(false);
        menuButton.current?.focus();
      }}
    >
      <div className="mx-auto flex min-h-[68px] w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <MotoShopBrand />

        <span className="hidden max-w-52 border-l border-white/20 pl-4 text-[0.62rem] leading-4 font-semibold tracking-[0.12em] text-white/65 uppercase xl:block">
          O Marketplace de quem vive o <span className="text-moto-brand">OFF-ROAD!</span>
        </span>

        <nav
          className="ml-6 hidden items-center gap-7 text-sm font-medium text-white/75 md:flex"
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
            Para lojistas
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <AccountLink />
          <CartPreview />
          <button
            ref={menuButton}
            type="button"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            aria-controls="storefront-mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex size-11 items-center justify-center rounded-md text-white/85 transition-colors hover:bg-white/10 hover:text-white md:hidden"
          >
            {menuOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
          </button>
        </div>
      </div>

      <nav
        id="storefront-mobile-navigation"
        aria-label="Navegação mobile"
        className="border-t border-white/10 bg-[#171716] px-4 py-2 md:hidden"
        hidden={!menuOpen}
      >
        <Link
          href="/products"
          onClick={() => setMenuOpen(false)}
          className="flex min-h-11 items-center border-b border-white/10 text-sm font-medium"
        >
          Catálogo
        </Link>
        <Link
          href="/seller"
          onClick={() => setMenuOpen(false)}
          className="flex min-h-11 items-center text-sm font-medium"
        >
          Para lojistas
        </Link>
      </nav>
    </header>
  );
}

function AccountLink() {
  const { data: session } = authClient.useSession();

  return (
    <Link
      href={session?.user ? "/orders" : "/login"}
      aria-label={session?.user ? "Minha conta e pedidos" : "Entrar na minha conta"}
      className="inline-flex size-11 items-center justify-center rounded-md text-white/85 transition-colors hover:bg-white/10 hover:text-white"
    >
      <UserRound aria-hidden="true" className="size-5" />
    </Link>
  );
}
