import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";

import { isVariantGender, type VariantGenderValue } from "../domain/variant-attributes";

export type VariantAttributeFilter = {
  gender?: VariantGenderValue | null | undefined;
  color?: string | null | undefined;
  size?: string | null | undefined;
};

/** Variantes que aparecem na vitrine: ativas, de produto aprovado e de loja aprovada ou ativa. */
const publicVariantWhere = {
  active: true,
  product: { status: "APPROVED", seller: { status: { in: ["APPROVED", "ACTIVE"] } } },
} satisfies Prisma.ProductVariantWhereInput;

/**
 * Trecho para `variants: { some: ... }` na busca da vitrine. Campos vazios não filtram;
 * cor e tamanho comparam sem diferenciar maiúsculas.
 */
export function buildVariantAttributeWhere(filter: VariantAttributeFilter): Prisma.ProductVariantWhereInput {
  return {
    active: true,
    ...(filter.gender ? { gender: filter.gender } : {}),
    ...(filter.color ? { color: { equals: filter.color, mode: "insensitive" } } : {}),
    ...(filter.size ? { size: { equals: filter.size, mode: "insensitive" } } : {}),
  };
}

/** Opções de filtro com pelo menos uma variante pública, ordenadas para exibição. */
export async function listPublicVariantAttributeOptions() {
  const [genders, colors, sizes] = await Promise.all([
    db.productVariant.findMany({
      where: { ...publicVariantWhere, gender: { not: null } },
      distinct: ["gender"],
      select: { gender: true },
    }),
    db.productVariant.findMany({
      where: { ...publicVariantWhere, color: { not: null } },
      distinct: ["color"],
      select: { color: true },
      orderBy: { color: "asc" },
    }),
    db.productVariant.findMany({
      where: { ...publicVariantWhere, size: { not: null } },
      distinct: ["size"],
      select: { size: true },
      orderBy: { size: "asc" },
    }),
  ]);

  return {
    genders: genders.map((variant) => variant.gender).filter(isVariantGender),
    colors: colors.map((variant) => variant.color).filter((color): color is string => Boolean(color)),
    sizes: sizes.map((variant) => variant.size).filter((size): size is string => Boolean(size)),
  };
}
