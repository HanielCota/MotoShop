import type { Route } from "next";
import {
  BadgeCheck,
  Bike,
  CircleCheck,
  Clock,
  Disc3,
  MapPin,
  Shield,
  UserRoundCheck,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export const categoryCards: { title: string; description: string; eyebrow: string; href: Route; icon: LucideIcon }[] = [
  {
    title: "Peças para sua moto",
    description: "Motor, transmissão, freios e suspensão",
    eyebrow: "Manutenção & performance",
    href: "/products",
    icon: Wrench,
  },
  {
    title: "Capacetes",
    description: "Proteção para adulto e infantil",
    eyebrow: "Segurança",
    href: "/categoria/equipment-helmets" as Route,
    icon: Shield,
  },
];

export const equipmentCategoryLabels: Record<string, string> = {
  "equipment-helmets": "Capacetes",
  "equipment-boots": "Botas",
  "equipment-goggles": "Óculos de proteção",
};

export const essentials: { title: string; description: string; href: Route; icon: LucideIcon }[] = [
  {
    title: "Óleos e Lubrificantes",
    description: "Manutenção para cada intervalo",
    icon: Disc3,
    href: "/products?q=%C3%B3leo",
  },
  {
    title: "Filtros",
    description: "Ar e óleo para manter o motor protegido",
    icon: CircleCheck,
    href: "/products?q=filtro",
  },
  {
    title: "Freios",
    description: "Pastilhas, discos e componentes",
    icon: ShieldCheck,
    href: "/categoria/parts-brakes" as Route,
  },
  { title: "Pneus e Câmaras", description: "Aderência para pista e trilha", icon: Bike, href: "/products?q=pneu" },
];

type HeroAssurance = { text: string; icon: LucideIcon };

const approvedStoresAssurance: HeroAssurance = { icon: BadgeCheck, text: "Lojas aprovadas pelo Moto Shop" };

/**
 * Garantias curtas exibidas logo abaixo da busca por moto, no hero. Enquanto o pagamento não está
 * liberado, nenhuma delas promete compra ou checkout.
 */
export function getHeroAssurances(paymentAvailable: boolean): HeroAssurance[] {
  if (!paymentAvailable) {
    return [
      approvedStoresAssurance,
      { icon: Clock, text: "Compras em breve" },
      { icon: MapPin, text: "Frete e prazo definidos por cada loja" },
    ];
  }

  return [
    approvedStoresAssurance,
    { icon: UserRoundCheck, text: "Compre sem criar conta" },
    { icon: MapPin, text: "Frete e prazo de cada loja no checkout" },
  ];
}

/** Links de categoria só aparecem quando a categoria existe e está ativa. */
export function isCategoryHrefActive(href: string, categories: { slug: string }[]) {
  return !href.startsWith("/categoria/") || categories.some((category) => href === `/categoria/${category.slug}`);
}
