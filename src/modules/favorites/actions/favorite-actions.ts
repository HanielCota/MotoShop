"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

import { ProductStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/database";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";

const productIdSchema = z.cuid();

export type FavoriteActionResult = { error?: string; isFavorite?: boolean };

export async function toggleFavoriteAction(productId: string): Promise<FavoriteActionResult> {
  const session = await requireAuthenticatedUser("/favorites");
  const parsedProductId = productIdSchema.safeParse(productId);
  if (!parsedProductId.success) return { error: "Produto inválido." };

  const product = await db.product.findFirst({
    where: { id: parsedProductId.data, status: ProductStatus.APPROVED },
    select: { id: true, slug: true },
  });
  if (!product) return { error: "Produto não encontrado." };

  try {
    const existingFavorite = await db.favorite.findUnique({
      where: { userId_productId: { userId: session.user.id, productId: product.id } },
    });

    if (existingFavorite) {
      await db.favorite.delete({ where: { id: existingFavorite.id } });
      revalidatePath("/favorites");
      revalidatePath(`/products/${product.slug}`);
      return { isFavorite: false };
    }

    await db.favorite.create({ data: { userId: session.user.id, productId: product.id } });
    revalidatePath("/favorites");
    revalidatePath(`/products/${product.slug}`);
    return { isFavorite: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Este produto já está nos seus favoritos." };
    }
    return { error: "Não foi possível atualizar seus favoritos." };
  }
}
