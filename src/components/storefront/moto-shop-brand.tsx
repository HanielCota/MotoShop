import Image from "next/image";
import Link from "next/link";
import styles from "./moto-shop-brand.module.css";

type MotoShopBrandProps = {
  variant?: "header" | "footer";
};

/**
 * Brand mark with a "holeshot" hover: the engine revs, the mark launches into a wheelie, the
 * orange livery sweeps in on a race-stripe diagonal, with speed lines and an exhaust puff.
 * Pure CSS (transform/opacity only); reduced-motion users get a plain crossfade.
 */
export function MotoShopBrand({ variant = "header" }: MotoShopBrandProps) {
  return (
    <Link href="/" className={`${styles.brand} ${styles[variant]}`} aria-label="O Moto Shop, página inicial">
      <span className={styles.exhaust} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className={`${styles.stage} ${styles[variant]}`}>
        <span className={styles.rider}>
          <Image
            className={`${styles.logo} ${styles.primary}`}
            src="/Banner2.png"
            alt=""
            aria-hidden="true"
            width={6000}
            height={1000}
            priority={variant === "header"}
          />
          <Image
            className={`${styles.logo} ${styles.alternate}`}
            src="/Banner1.png"
            alt=""
            aria-hidden="true"
            width={6000}
            height={1000}
            priority={variant === "header"}
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
