import { describe, expect, it } from "vitest";

import {
  CART_ITEM_LIFETIME_MS,
  getPurchaseCartDiscardReason,
  readPurchaseCart,
  withPurchaseCart,
  withoutPurchaseCart,
  type PurchaseCart,
} from "./purchase-cart";

const now = new Date("2026-10-08T12:00:00.000Z");
const cart: PurchaseCart = {
  step: "CART_CREATED",
  cartItemId: "cart-1",
  serviceCode: "1",
  createdAt: now.toISOString(),
  volumeCount: 1,
};

describe("purchase cart metadata", () => {
  it("round-trips the cart item while preserving other provider metadata", () => {
    const metadata = withPurchaseCart({ previousLabels: [{ externalShipmentId: "old" }] }, cart);
    expect(readPurchaseCart(metadata)).toEqual(cart);
    expect(metadata.previousLabels).toEqual([{ externalShipmentId: "old" }]);
  });

  it("ignores malformed cart metadata", () => {
    expect(readPurchaseCart({ purchaseCart: { step: "CART_CREATED", cartItemId: "" } })).toBeNull();
    expect(readPurchaseCart(null)).toBeNull();
  });

  it("reuses the cart item only for the same service within the provider's 7-day window", () => {
    expect(getPurchaseCartDiscardReason(cart, "1", now)).toBeNull();
    expect(getPurchaseCartDiscardReason(cart, "2", now)).toBe("SERVICE_CHANGED");
    expect(getPurchaseCartDiscardReason(cart, "1", new Date(now.getTime() + CART_ITEM_LIFETIME_MS))).toBe("EXPIRED");
  });

  it("records discarded cart items for audit", () => {
    const metadata = withoutPurchaseCart(withPurchaseCart({}, cart), { reason: "EXPIRED", at: now });
    expect(metadata).toEqual({
      discardedPurchaseCarts: [{ cartItemId: "cart-1", reason: "EXPIRED", discardedAt: now.toISOString() }],
    });
    expect(withoutPurchaseCart(withPurchaseCart({ a: 1 }, cart))).toEqual({ a: 1 });
  });
});
