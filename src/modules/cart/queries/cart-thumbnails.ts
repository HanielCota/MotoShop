import "server-only";

import { db } from "@/lib/database";
import { getPublicStorageUrl } from "@/shared/storage/public-storage-url";

export type CartThumbnail = { url: string; alt: string };

/**
 * Miniaturas dos itens do carrinho: prioriza a imagem da variante e cai para a primeira
 * imagem do produto. Consulta separada porque `getActiveCart` não inclui imagens.
 * Usada pela página do carrinho, pelo carrinho rápido e pelo resumo do checkout.
 */
export async function getCartThumbnails(
  items: { variantId: string; variant: { productId: string } }[],
): Promise<Map<string, CartThumbnail>> {
  const thumbnails = new Map<string, CartThumbnail>();
  if (items.length === 0) return thumbnails;
  try {
    const images = await db.productImage.findMany({
      where: { productId: { in: [...new Set(items.map((item) => item.variant.productId))] } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { storageKey: true, altText: true, productId: true, variantId: true },
    });
    for (const item of items) {
      const productImages = images.filter((image) => image.productId === item.variant.productId);
      const image = productImages.find((entry) => entry.variantId === item.variantId) ?? productImages[0];
      const url = image ? getPublicStorageUrl(image.storageKey) : null;
      if (image && url) thumbnails.set(item.variantId, { url, alt: image.altText ?? "" });
    }
  } catch {
    // Miniaturas são decorativas: o carrinho continua funcionando sem elas.
  }
  return thumbnails;
}
