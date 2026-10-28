import type { Route } from "next";
import { BadgeCheck, Shield, Truck, UserRoundCheck, Wrench, type LucideIcon } from "lucide-react";

// Product cutouts (transparent background) shown behind a frosted glass on each card; decorative only.
// The white text needs at least 4.5:1 over them, so light photos are darkened when exported: pecas.webp
// at 50% and equipamentos.webp at 85% of the source brightness. Darken any new photo the same way and
// re-check the contrast on phone and desktop.
export const categoryCards: {
  title: string;
  description: string;
  eyebrow: string;
  href: Route;
  icon: LucideIcon;
  image: string;
}[] = [
  {
    title: "Peças para sua moto",
    description: "Motor, transmissão, freios e suspensão",
    eyebrow: "Manutenção & performance",
    href: "/products",
    icon: Wrench,
    image: "/images/home/categories/pecas.webp",
  },
  {
    title: "Capacetes",
    description: "Proteção para adulto e infantil",
    eyebrow: "Segurança",
    href: "/categoria/equipment-helmets" as Route,
    icon: Shield,
    image: "/images/home/categories/capacetes.webp",
  },
];

export const equipmentCardImage = "/images/home/categories/equipamentos.webp";

export const equipmentCategoryLabels: Record<string, string> = {
  "equipment-helmets": "Capacetes",
  "equipment-boots": "Botas",
  "equipment-goggles": "Óculos de proteção",
};

// No icons here (IC-02): Lucide has no honest symbol for filters or tires, and the title names the category.
export const essentials: { title: string; description: string; href: Route }[] = [
  {
    title: "Óleos e Lubrificantes",
    description: "Manutenção para cada intervalo",
    href: "/products?q=%C3%B3leo",
  },
  {
    title: "Filtros",
    description: "Ar e óleo para manter o motor protegido",
    href: "/products?q=filtro",
  },
  {
    title: "Freios",
    description: "Pastilhas, discos e componentes",
    href: "/categoria/parts-brakes" as Route,
  },
  { title: "Pneus e Câmaras", description: "Aderência para pista e trilha", href: "/products?q=pneu" },
];

type HeroAssurance = { text: string; icon: LucideIcon };

const approvedStoresAssurance: HeroAssurance = { icon: BadgeCheck, text: "Lojas aprovadas pelo Moto Shop" };

/**
 * Garantias curtas exibidas logo abaixo da busca por moto, no hero. O site se comporta como em
 * produção: nenhuma garantia avisa que as compras ainda não foram liberadas.
 */
export function getHeroAssurances(): HeroAssurance[] {
  return [
    approvedStoresAssurance,
    { icon: UserRoundCheck, text: "Compre sem criar conta" },
    { icon: Truck, text: "Frete e prazo de cada loja no checkout" },
  ];
}

/** Links de categoria só aparecem quando a categoria existe e está ativa. */
export function isCategoryHrefActive(href: string, categories: { slug: string }[]) {
  return !href.startsWith("/categoria/") || categories.some((category) => href === `/categoria/${category.slug}`);
}
