/**
 * Estado intermediário da compra de etiqueta no Melhor Envio, guardado em `Shipment.providerMetadata`.
 *
 * A compra tem dois passos no provedor: inserir no carrinho (`POST /api/v2/me/cart`, não idempotente)
 * e pagar (`POST /api/v2/me/shipment/checkout`). O id do item de carrinho é persistido logo após o
 * passo 1 (`step: "CART_CREATED"`) para que novas tentativas façam apenas o checkout, sem criar outro
 * item. A documentação informa que o item fica disponível para compra por 7 dias.
 */
export const PURCHASE_CART_METADATA_KEY = "purchaseCart";
export const DISCARDED_PURCHASE_CARTS_KEY = "discardedPurchaseCarts";
export const CART_ITEM_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export type PurchaseCart = {
  step: "CART_CREATED";
  cartItemId: string;
  serviceCode: string;
  createdAt: string;
  volumeCount: number;
  quotedPriceInCents?: number;
};

export type PurchaseCartDiscardReason = "EXPIRED" | "SERVICE_CHANGED" | "NOT_FOUND_AT_PROVIDER";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function readPurchaseCart(metadata: unknown): PurchaseCart | null {
  const candidate = asRecord(asRecord(metadata)[PURCHASE_CART_METADATA_KEY]);
  if (
    candidate.step !== "CART_CREATED" ||
    typeof candidate.cartItemId !== "string" ||
    candidate.cartItemId.trim() === "" ||
    candidate.cartItemId.length > 100 ||
    typeof candidate.serviceCode !== "string" ||
    typeof candidate.createdAt !== "string" ||
    Number.isNaN(Date.parse(candidate.createdAt))
  )
    return null;
  return {
    step: "CART_CREATED",
    cartItemId: candidate.cartItemId,
    serviceCode: candidate.serviceCode,
    createdAt: candidate.createdAt,
    volumeCount: typeof candidate.volumeCount === "number" ? candidate.volumeCount : 0,
    ...(typeof candidate.quotedPriceInCents === "number" ? { quotedPriceInCents: candidate.quotedPriceInCents } : {}),
  };
}

/** Motivo para não reutilizar o item de carrinho salvo, ou `null` quando ele pode ser pago. */
export function getPurchaseCartDiscardReason(
  cart: PurchaseCart,
  serviceCode: string,
  now: Date = new Date(),
): PurchaseCartDiscardReason | null {
  if (cart.serviceCode !== serviceCode) return "SERVICE_CHANGED";
  if (now.getTime() - Date.parse(cart.createdAt) >= CART_ITEM_LIFETIME_MS) return "EXPIRED";
  return null;
}

export function withPurchaseCart(metadata: unknown, cart: PurchaseCart): Record<string, unknown> {
  return { ...asRecord(metadata), [PURCHASE_CART_METADATA_KEY]: cart };
}

/** Remove o item de carrinho pendente, mantendo o histórico do descarte para auditoria. */
export function withoutPurchaseCart(
  metadata: unknown,
  discard?: { reason: PurchaseCartDiscardReason; at?: Date },
): Record<string, unknown> {
  const record = asRecord(metadata);
  const cart = readPurchaseCart(record);
  const rest = Object.fromEntries(Object.entries(record).filter(([key]) => key !== PURCHASE_CART_METADATA_KEY));
  if (!cart || !discard) return rest;
  const history = Array.isArray(record[DISCARDED_PURCHASE_CARTS_KEY]) ? record[DISCARDED_PURCHASE_CARTS_KEY] : [];
  return {
    ...rest,
    [DISCARDED_PURCHASE_CARTS_KEY]: [
      ...history,
      { cartItemId: cart.cartItemId, reason: discard.reason, discardedAt: (discard.at ?? new Date()).toISOString() },
    ],
  };
}
