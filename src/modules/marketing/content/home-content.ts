import type { Route } from "next";
import {
  BadgeCheck,
  Bike,
  CircleCheck,
  Disc3,
  MapPin,
  PackageCheck,
  Shield,
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
    title: "Óleos e lubrificantes",
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
  { title: "Pneus e câmaras", description: "Aderência para pista e trilha", icon: Bike, href: "/products?q=pneu" },
];

export const trustItems: { title: string; text: string; icon: LucideIcon }[] = [
  { icon: BadgeCheck, title: "Lojistas parceiros", text: "Lojas aprovadas pelo Moto Shop" },
  { icon: PackageCheck, title: "Peças compatíveis", text: "Confira se a peça serve na sua moto" },
  { icon: MapPin, title: "Frete por loja", text: "Opções e prazos no checkout" },
  { icon: ShieldCheck, title: "Pedido acompanhado", text: "Status de pagamento e entrega" },
];

/** Links de categoria só aparecem quando a categoria existe e está ativa. */
export function isCategoryHrefActive(href: string, categories: { slug: string }[]) {
  return !href.startsWith("/categoria/") || categories.some((category) => href === `/categoria/${category.slug}`);
}
