import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server";

export const inventoryMovementTypeValues = [
  "ALL",
  "SALE",
  "RESERVATION",
  "RESERVATION_RELEASE",
  "RETURN",
  "CANCELLATION",
  "MANUAL_IN",
  "MANUAL_OUT",
  "CORRECTION",
] as const;
export const inventorySortValues = ["newest", "oldest"] as const;
export type InventorySort = (typeof inventorySortValues)[number];

export const inventorySearchParams = {
  q: parseAsString,
  movementType: parseAsStringLiteral(inventoryMovementTypeValues).withDefault("ALL"),
  from: parseAsString,
  to: parseAsString,
  sort: parseAsStringLiteral(inventorySortValues).withDefault("newest"),
};

export const loadInventorySearchParams = createLoader(inventorySearchParams);
