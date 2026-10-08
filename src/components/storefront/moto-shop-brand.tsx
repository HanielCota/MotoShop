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
 * Pure CSS (transform/opacity only); reduced-motion users get a plain crossfade.
 */
export function MotoShopBrand({ variant = "header" }: MotoShopBrandProps) {
  const asset = variant === "header" ? logoAssets.horizontal : logoAssets.stacked;
  const priority = variant !== "footer";

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
            priority={priority}
          />
          <Image
            className={`${styles.logo} ${styles.alternate}`}
            src={asset.alternate}
            alt=""
            aria-hidden="true"
            width={asset.width}
            height={asset.height}
            priority={priority}
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
