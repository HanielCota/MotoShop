import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { formatMoneyInCents } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Dados de apresentação do card; derivados no servidor a partir de produtos aprovados. */
export type ProductCardData = {
  id: string;
  name: string;
  href: `/products/${string}`;
  imageUrl: string | null;
  imageAlt: string;
  category: { label: string; href?: Route | undefined };
  brand?: { name: string; href?: Route | undefined } | undefined;
  seller?: { name: string; href?: Route | undefined } | undefined;
  priceInCents: number | null;
  /** Preço normal da variante mais barata quando ela está em promoção ativa. */
  compareAtPriceInCents?: number | null | undefined;
  hasPriceRange: boolean;
  availableQuantity: number;
  isDemo: boolean;
  sponsored: boolean;
};

/**
 * Card público de produto (server component). Usado no catálogo, nas vitrines,
 * na homepage e em favoritos para manter um único padrão visual.
 */
export function ProductCard({
  product,
  eager = false,
  headingLevel = "h3",
  action,
}: {
  product: ProductCardData;
  /** Apenas a primeira imagem visível deve ser carregada imediatamente. */
  eager?: boolean;
  headingLevel?: "h2" | "h3";
  /** Ação secundária opcional (ex.: botão de favorito). */
  action?: ReactNode;
}) {
  const Heading = headingLevel;
  const inStock = product.availableQuantity > 0;
  const onSale =
    !product.isDemo &&
    product.compareAtPriceInCents != null &&
    product.priceInCents !== null &&
    product.compareAtPriceInCents > product.priceInCents;

  return (
    <article className="group/card border-border bg-card text-card-foreground relative flex w-full min-w-0 flex-col overflow-hidden rounded-xl border transition-shadow hover:shadow-md">
      <Link
        href={product.href}
        aria-label={`Ver ${product.name}`}
        tabIndex={-1}
        className="bg-surface-sunken relative block aspect-square overflow-hidden"
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.imageAlt}
            width={640}
            height={640}
            loading={eager ? "eager" : "lazy"}
            unoptimized
            className="size-full object-contain transition-transform duration-200 group-hover/card:scale-[1.02] motion-reduce:transition-none"
          />
        ) : (
          <span className="text-muted-foreground flex size-full items-center justify-center p-4 text-center text-xs sm:text-sm">
            Imagem não disponível
          </span>
        )}
        {product.isDemo || product.sponsored || onSale ? (
          <span className="absolute top-2 left-2 flex flex-wrap gap-1">
            {product.isDemo ? (
              <Badge variant="neutral" className="bg-card/95">
                Demonstração
              </Badge>
            ) : null}
            {onSale ? <Badge>Oferta</Badge> : null}
            {product.sponsored && !product.isDemo ? (
              <Badge variant="brand" className="bg-card/95">
                Patrocinado · Loja VIP
              </Badge>
            ) : null}
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
          {product.category.href ? (
            <Link href={product.category.href} className="text-brand-strong font-semibold hover:underline">
              {product.category.label}
            </Link>
          ) : (
            <span className="text-brand-strong font-semibold">{product.category.label}</span>
          )}
          {product.brand ? (
            <>
              <span aria-hidden="true">·</span>
              {product.brand.href ? (
                <Link href={product.brand.href} className="hover:text-foreground hover:underline">
                  {product.brand.name}
                </Link>
              ) : (
                <span>{product.brand.name}</span>
              )}
            </>
          ) : null}
        </div>

        <Heading className="line-clamp-2 font-sans text-sm leading-snug font-semibold tracking-normal sm:text-base">
          <Link href={product.href} className="hover:underline">
            {product.name}
          </Link>
        </Heading>

        {product.seller ? (
          <p className="text-muted-foreground truncate text-xs">
            {product.seller.href ? (
              <Link href={product.seller.href} className="hover:text-foreground hover:underline">
                {product.seller.name}
              </Link>
            ) : (
              product.seller.name
            )}
          </p>
        ) : null}

        <div className="mt-auto pt-2">
          {product.hasPriceRange && !product.isDemo ? (
            <span className="text-muted-foreground block text-xs">A partir de</span>
          ) : null}
          {onSale ? (
            <span className="text-muted-foreground block text-xs line-through">
              <span className="sr-only">Preço normal: </span>
              {formatMoneyInCents(product.compareAtPriceInCents!)}
            </span>
          ) : null}
          <p className="text-foreground text-base font-semibold sm:text-lg">
            {onSale ? <span className="sr-only">Preço promocional: </span> : null}
            {product.priceInCents !== null ? formatMoneyInCents(product.priceInCents) : "Sob consulta"}
          </p>
          <p
            className={cn(
              "text-xs",
              inStock || product.isDemo ? "text-muted-foreground" : "text-warning-foreground font-medium",
            )}
          >
            {product.isDemo ? "Exemplo ilustrativo · compra indisponível" : inStock ? "Em estoque" : "Indisponível"}
          </p>
        </div>
        {action ? <div className="pt-2 [&_button]:w-full">{action}</div> : null}
      </div>
    </article>
  );
}
