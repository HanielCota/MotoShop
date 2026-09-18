import { describe, expect, it } from "vitest";

import {
  adjustAvailableInventory,
  commitInventorySale,
  releaseInventoryReservation,
  reserveInventory,
} from "./inventory-balance";

describe("inventory reservations", () => {
  it("moves available units into reserved units", () => {
    expect(reserveInventory({ availableQuantity: 8, reservedQuantity: 2 }, 3)).toEqual({
      availableQuantity: 5,
      reservedQuantity: 5,
    });
  });

  it("releases units back into available inventory", () => {
    expect(releaseInventoryReservation({ availableQuantity: 5, reservedQuantity: 5 }, 3)).toEqual({
      availableQuantity: 8,
      reservedQuantity: 2,
    });
  });

  it("commits a sale without returning reserved units to availability", () => {
    expect(commitInventorySale({ availableQuantity: 5, reservedQuantity: 5 }, 3)).toEqual({
      availableQuantity: 5,
      reservedQuantity: 2,
    });
  });

  it("rejects reservations larger than available inventory", () => {
    expect(() => reserveInventory({ availableQuantity: 2, reservedQuantity: 0 }, 3)).toThrow("enough available");
  });
});

describe("inventory adjustments", () => {
  it("rejects adjustments that would create negative inventory", () => {
    expect(() => adjustAvailableInventory({ availableQuantity: 2, reservedQuantity: 0 }, -3)).toThrow(
      "cannot make availableQuantity negative",
    );
  });
});
