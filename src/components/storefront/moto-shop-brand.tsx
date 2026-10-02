import Image from "next/image";
import Link from "next/link";
import styles from "./moto-shop-brand.module.css";

type MotoShopBrandProps = {
  variant?: "header" | "footer";
};

export function MotoShopBrand({ variant = "header" }: MotoShopBrandProps) {
  return (
    <Link href="/" className={`${styles.brand} ${styles[variant]}`} aria-label="O Moto Shop, página inicial">
      <span className={`${styles.stage} ${styles[variant]}`}>
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
    </Link>
  );
}
