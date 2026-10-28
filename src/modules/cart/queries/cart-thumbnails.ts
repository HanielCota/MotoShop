import "server-only";

import { db } from "@/lib/database";
import { logger } from "@/lib/logger";
import { getPublicStorageUrl } from "@/shared/storage/public-storage-url";

export type CartThumbnail = { url: string; alt: string };

type ThumbnailLine = { key: string; productId: string; variantId: string | null };

/**
 * Miniaturas de linhas que apontam para um produto (carrinho, itens de pedido): prioriza a imagem
 * da variante e cai para a primeira imagem do produto. Cada miniatura sai na chave da sua linha.
 */
export async function getProductThumbnails(lines: readonly ThumbnailLine[]): Promise<Map<string, CartThumbnail>> {
  const thumbnails = new Map<string, CartThumbnail>();
  if (lines.length === 0) return thumbnails;
  try {
    const images = await db.productImage.findMany({
      where: { productId: { in: [...new Set(lines.map((line) => line.productId))] } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { storageKey: true, altText: true, productId: true, variantId: true },
    });
    for (const line of lines) {
      const productImages = images.filter((image) => image.productId === line.productId);
      const image = productImages.find((entry) => entry.variantId === line.variantId) ?? productImages[0];
      if (image == null) continue;

      const url = getPublicStorageUrl(image.storageKey);
      if (url == null) continue;

      thumbnails.set(line.key, { url, alt: image.altText ?? "" });
    }
  } catch (error) {
    // Miniaturas são decorativas: a tela continua funcionando sem elas, e a falha fica no log.
    logger.warn({
      event: "catalog.thumbnails_unavailable",
      lineCount: lines.length,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
  }
  return thumbnails;
}

/**
 * Miniaturas dos itens do carrinho, pela variante. Consulta separada porque `getActiveCart` não
 * inclui imagens. Usada pela página do carrinho, pelo carrinho rápido do cabeçalho e pelo resumo do checkout.
 */
export async function getCartThumbnails(
  items: { variantId: string; variant: { productId: string } }[],
): Promise<Map<string, CartThumbnail>> {
  return getProductThumbnails(
    items.map((item) => ({ key: item.variantId, productId: item.variant.productId, variantId: item.variantId })),
  );
}
