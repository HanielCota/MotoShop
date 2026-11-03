import "server-only";

import { getProductThumbnails, type CartThumbnail } from "@/modules/cart/queries/cart-thumbnails";

type OrderItemReference = { id: string; productId: string | null; variantId: string | null };

/**
 * Product photo of each order item, by item id, with the same rule as the cart. The items come from a
 * query the screen already ran (and already scoped to the customer, seller or admin), so this only
 * reads public product photos. Items whose product was deleted have no photo and get the placeholder.
 */
export async function getOrderItemThumbnails(
  items: readonly OrderItemReference[],
): Promise<Map<string, CartThumbnail>> {
  const lines = items.flatMap((item) =>
    item.productId == null ? [] : [{ key: item.id, productId: item.productId, variantId: item.variantId }],
  );

  return getProductThumbnails(lines);
}
