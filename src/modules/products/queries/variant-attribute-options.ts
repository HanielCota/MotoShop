import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";

import type { VariantGenderValue } from "../domain/variant-attributes";

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

/**
 * Cores e tamanhos com pelo menos uma variante pública, ordenados para exibição. O gênero não é
 * consultado: o filtro sempre oferece Masculino, Feminino e Unissex.
 */
export async function listPublicVariantAttributeOptions() {
  const [colors, sizes] = await Promise.all([
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
    colors: colors.map((variant) => variant.color).filter((color): color is string => Boolean(color)),
    sizes: sizes.map((variant) => variant.size).filter((size): size is string => Boolean(size)),
  };
}
