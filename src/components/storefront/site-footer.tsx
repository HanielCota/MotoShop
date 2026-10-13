import type { Route } from "next";
import Link from "next/link";

import { MotoShopBrand } from "@/components/storefront/moto-shop-brand";
import { BRAND_SHORT_DESCRIPTION, BRAND_SLOGAN } from "@/config/brand";

import { sellerLinkLabel } from "./storefront-routes";

const footerColumns: { title: string; links: { label: string; href: Route }[] }[] = [
  {
    title: "Institucional",
    links: [
      { label: "Início", href: "/" },
      { label: "Categorias", href: "/#categorias" },
      { label: "Encontre peças para sua moto", href: "/#minha-moto" },
    ],
  },
  {
    title: "Compras",
    links: [
      { label: "Catálogo", href: "/products" },
      { label: "Favoritos", href: "/favorites" },
      { label: "Carrinho", href: "/cart" },
      { label: "Meus pedidos", href: "/orders" },
    ],
  },
  {
    title: "Para lojistas",
    links: [
      { label: sellerLinkLabel, href: "/seller" },
      { label: "Acessar minha conta", href: "/login" },
    ],
  },
];

/** Rodapé público compartilhado; renderizado pelo layout raiz nas rotas da loja. */
export function SiteFooter() {
  return (
    <footer className="bg-moto-brand-foreground text-white">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 pt-10 pb-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-3">
          <MotoShopBrand variant="footer" />
          <p className="text-moto-brand text-xs font-bold tracking-[0.12em] uppercase">{BRAND_SLOGAN}</p>
          <p className="max-w-sm text-sm leading-6 text-white/65">{BRAND_SHORT_DESCRIPTION}</p>
        </div>
        <nav aria-label="Links do rodapé" className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          {footerColumns.map((column) => (
            <div key={column.title} className="flex flex-col">
              <p className="text-moto-brand mb-1 text-xs font-bold tracking-[0.12em] uppercase">{column.title}</p>
              {column.links.map((link) => (
                // 44px touch target on phones; about 30% tighter from the tablet up, where a mouse is used.
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex min-h-11 items-center text-sm text-white/70 transition-colors hover:text-white sm:min-h-[31px]"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <p className="border-t border-white/15 pt-4 text-xs text-white/55 lg:col-span-2">
          © 2026 O Moto Shop Brasil. Plataforma de intermediação entre clientes e lojistas parceiros.
        </p>
      </div>
    </footer>
  );
}
