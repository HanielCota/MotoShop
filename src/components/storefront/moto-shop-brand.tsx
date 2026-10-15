import Image from "next/image";
import Link from "next/link";

import { BRAND_NAME } from "@/config/brand";

import styles from "./moto-shop-brand.module.css";

type MotoShopBrandVariant = "header" | "footer" | "auth";

type MotoShopBrandProps = {
  variant?: MotoShopBrandVariant;
};

/**
 * Optimized derivatives of the official artwork (public/Banner*.png, public/LargeBanner*.png) live in
 * public/brand. The header keeps the horizontal mark; footer and auth use the main (stacked) logo.
 * The "dark" files are the client's transparent logos (Banner2-Sem-Fundo, LogoPrincipal2-Sem-Fundo)
 * on the site graphite (#171716), so the plate blends into the header and footer.
 */
const logoAssets = {
  horizontal: {
    primary: "/brand/logo-horizontal-dark.webp",
    alternate: "/brand/logo-horizontal-orange.webp",
    width: 534,
    height: 89,
  },
  stacked: {
    primary: "/brand/logo-stacked-dark.webp",
    alternate: "/brand/logo-stacked-orange.webp",
    width: 640,
    height: 256,
  },
} as const;

/**
 * Brand mark with a "holeshot" hover: the engine revs, the mark launches into a wheelie, the
 * orange livery sweeps in on a race-stripe diagonal, with speed lines and an exhaust puff.
 * Pure CSS (transform/opacity/clip-path); reduced-motion users get the stripe sweep without movement.
 */
export function MotoShopBrand({ variant = "header" }: MotoShopBrandProps) {
  const asset = variant === "header" ? logoAssets.horizontal : logoAssets.stacked;
  // The primary mark is often the LCP (header, auth, and the footer on short account pages), so it
  // loads eagerly; the orange alternate only shows on hover and stays lazy.
  const fetchPriority = variant === "footer" ? "auto" : "high";

  return (
    <Link href="/" className={`${styles.brand} ${styles[variant]}`} aria-label={`${BRAND_NAME}, página inicial`}>
      <span className={styles.exhaust} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className={styles.stage}>
        <span className={styles.rider}>
          <Image
            className={`${styles.logo} ${styles.primary}`}
            src={asset.primary}
            alt=""
            aria-hidden="true"
            width={asset.width}
            height={asset.height}
            loading="eager"
            fetchPriority={fetchPriority}
          />
          <Image
            className={`${styles.logo} ${styles.alternate}`}
            src={asset.alternate}
            alt=""
            aria-hidden="true"
            width={asset.width}
            height={asset.height}
          />
        </span>
        <span className={styles.speedLines} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </span>
    </Link>
  );
}
