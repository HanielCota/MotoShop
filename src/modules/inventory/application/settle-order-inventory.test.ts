import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: {} }));

import { cancelCommittedInventory } from "./settle-order-inventory";

describe("cancelCommittedInventory", () => {
  it("records the cancellation request as the movement reference with the acting user", async () => {
    const movementCreate = vi.fn();
    const tx = {
      inventory: {
        findUnique: vi.fn().mockResolvedValue({ id: "inventory-1" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ availableQuantity: 5, reservedQuantity: 0 }),
      },
      inventoryMovement: { create: movementCreate },
    };

    await cancelCommittedInventory(
      tx as never,
      [{ sellerId: "seller-1", items: [{ variantId: "variant-1", quantity: 2 }] }],
      { referenceType: "CANCELLATION_REQUEST", referenceId: "cancellation-1", actorUserId: "admin-1" },
    );

    expect(tx.inventory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "inventory-1", sellerId: "seller-1" } }),
    );
    expect(movementCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "CANCELLATION",
        quantityChange: 2,
        referenceType: "CANCELLATION_REQUEST",
        referenceId: "cancellation-1",
        actorUserId: "admin-1",
        sellerId: "seller-1",
      }),
    });
  });
});
