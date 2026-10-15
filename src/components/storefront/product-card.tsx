import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { formatMoneyInCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getPublicStockStatus, publicStockStatusLabel } from "@/modules/products/domain/stock-status";

import { getProductCardBadges, type ProductCardBadge } from "./product-card-badges";

function ProductCardBadgeLabel({ badge }: { badge: ProductCardBadge }) {
  if (badge === "DEMO")
    return (
      <Badge variant="neutral" className="bg-card/95">
        Demonstração
      </Badge>
    );
  if (badge === "SPONSORED")
    return (
      <Badge variant="brand" className="bg-card/95">
        Patrocinado · Loja VIP
      </Badge>
    );
  if (badge === "SALE") return <Badge>Oferta</Badge>;

  return <Badge variant="inverse">Novidade</Badge>;
}

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
  /** Approved in the last 30 days (computed on the server, see `isNewProduct`). */
  isNew: boolean;
};

/** Width requested from ImageKit for card images: about 2x the widest card (~300 CSS px). */
export const PRODUCT_CARD_IMAGE_WIDTH = 640;

/** Cards in the first screen (2 rows on phones, the first row on desktop) load eagerly: one of them is the LCP. */
export const EAGER_PRODUCT_CARDS = 4;

/** 2 columns on phones, 3 on tablets and up to 4 on desktop grids. */
const PRODUCT_CARD_IMAGE_SIZES = "(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw";

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
  /** Só as imagens da primeira tela devem carregar imediatamente (ver EAGER_PRODUCT_CARDS). */
  eager?: boolean;
  headingLevel?: "h2" | "h3";
  /** Ação secundária opcional (ex.: botão de favorito). */
  action?: ReactNode;
}) {
  const Heading = headingLevel;
  const stockStatus = getPublicStockStatus(product.availableQuantity);
  const onSale =
    product.compareAtPriceInCents != null &&
    product.priceInCents !== null &&
    product.compareAtPriceInCents > product.priceInCents;
  const badges = getProductCardBadges({
    isDemo: product.isDemo,
    sponsored: product.sponsored,
    onSale,
    isNew: product.isNew,
  });

  return (
    <article
      data-slot="product-card"
      className="group/card border-border bg-card text-card-foreground relative flex w-full min-w-0 flex-col overflow-hidden rounded-xl border transition-shadow hover:shadow-md"
    >
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
            width={PRODUCT_CARD_IMAGE_WIDTH}
            height={PRODUCT_CARD_IMAGE_WIDTH}
            sizes={PRODUCT_CARD_IMAGE_SIZES}
            loading={eager ? "eager" : "lazy"}
            // Local demo files go through the Next optimizer; ImageKit URLs are already resized via ?tr=w-.
            unoptimized={!product.imageUrl.startsWith("/")}
            className="size-full object-contain transition-transform duration-200 group-hover/card:scale-[1.02] motion-reduce:transition-none"
          />
        ) : (
          <span className="text-muted-foreground flex size-full items-center justify-center p-4 text-center text-xs sm:text-sm">
            Imagem não disponível
          </span>
        )}
        {badges.length > 0 ? (
          <span className="absolute top-2 left-2 flex flex-wrap gap-1">
            {badges.map((badge) => (
              <ProductCardBadgeLabel key={badge} badge={badge} />
            ))}
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
          {onSale && product.compareAtPriceInCents != null ? (
            <span className="text-muted-foreground block text-xs line-through">
              <span className="sr-only">Preço normal: </span>
              {formatMoneyInCents(product.compareAtPriceInCents)}
            </span>
          ) : null}
          <p className="text-foreground text-base font-semibold sm:text-lg">
            {onSale ? <span className="sr-only">Preço promocional: </span> : null}
            {product.priceInCents !== null ? formatMoneyInCents(product.priceInCents) : "Sob consulta"}
          </p>
          <p
            className={cn(
              "text-xs",
              stockStatus === "in-stock"
                ? "text-muted-foreground"
                : stockStatus === "last-units"
                  ? "text-warning-foreground font-semibold"
                  : "text-foreground font-medium",
            )}
          >
            {publicStockStatusLabel[stockStatus]}
            {product.isDemo ? " · demonstração" : ""}
          </p>
        </div>
        {action ? <div className="pt-2 [&_button]:w-full">{action}</div> : null}
      </div>
    </article>
  );
}
