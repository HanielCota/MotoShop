"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShoppingBag, UserRound, X } from "lucide-react";
import { useState } from "react";

export function StorefrontNavigation() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!pathname || pathname === "/" || /^\/(admin|api|seller)(\/|$)/.test(pathname)) return null;

  const catalogActive = pathname === "/products" || pathname.startsWith("/products/");

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#171716] text-white shadow-sm">
      <div className="mx-auto flex min-h-[68px] w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex min-h-11 shrink-0 items-center" aria-label="Moto Shop, página inicial">
          <Image
            src="/Banner2-Sem-Fundo.png"
            alt="Moto Shop"
            width={6000}
            height={1000}
            priority
            className="h-auto w-[142px] object-contain sm:w-[174px]"
          />
        </Link>

        <nav
          className="ml-6 hidden items-center gap-7 text-sm font-medium text-white/75 md:flex"
          aria-label="Navegação principal"
        >
          <Link
            href="/products"
            aria-current={catalogActive ? "page" : undefined}
            className="inline-flex min-h-11 items-center transition-colors hover:text-white aria-[current=page]:text-[#ff7b3d]"
          >
            Catálogo
          </Link>
          <Link
            href="/account/motorcycles"
            className="inline-flex min-h-11 items-center transition-colors hover:text-white"
          >
            Minhas motos
          </Link>
          <Link href="/seller" className="inline-flex min-h-11 items-center transition-colors hover:text-white">
            Para lojistas
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/login"
            aria-label="Entrar na minha conta"
            className="inline-flex size-11 items-center justify-center rounded-md text-white/85 transition-colors hover:bg-white/10 hover:text-white"
          >
            <UserRound aria-hidden="true" className="size-5" />
          </Link>
          <Link
            href="/cart"
            aria-label="Abrir carrinho"
            className="inline-flex size-11 items-center justify-center rounded-md text-white/85 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ShoppingBag aria-hidden="true" className="size-5" />
          </Link>
          <button
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

      {menuOpen ? (
        <nav
          id="storefront-mobile-navigation"
          aria-label="Navegação mobile"
          className="border-t border-white/10 bg-[#171716] px-4 py-2 md:hidden"
        >
          <Link
            href="/products"
            onClick={() => setMenuOpen(false)}
            className="flex min-h-11 items-center border-b border-white/10 text-sm font-medium"
          >
            Catálogo
          </Link>
          <Link
            href="/account/motorcycles"
            onClick={() => setMenuOpen(false)}
            className="flex min-h-11 items-center border-b border-white/10 text-sm font-medium"
          >
            Minhas motos
          </Link>
          <Link
            href="/seller"
            onClick={() => setMenuOpen(false)}
            className="flex min-h-11 items-center text-sm font-medium"
          >
            Para lojistas
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
