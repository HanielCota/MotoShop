import { ApplicationError } from "@/shared/errors/application-error";

export const MAX_INVENTORY_QUANTITY = 2_147_483_647;

export type InventoryBalance = Readonly<{
  availableQuantity: number;
  reservedQuantity: number;
}>;

export function reserveInventory(balance: InventoryBalance, quantity: number): InventoryBalance {
  assertInventoryBalance(balance);
  assertPositiveQuantity(quantity);

  if (quantity > balance.availableQuantity) {
    throw new ApplicationError({
      code: "OUT_OF_STOCK",
      message: "There is not enough available inventory to create the reservation.",
      statusCode: 409,
    });
  }

  return {
    availableQuantity: balance.availableQuantity - quantity,
    reservedQuantity: balance.reservedQuantity + quantity,
  };
}

export function releaseInventoryReservation(balance: InventoryBalance, quantity: number): InventoryBalance {
  assertInventoryBalance(balance);
  assertPositiveQuantity(quantity);
  assertReservedQuantity(balance, quantity);

  return {
    availableQuantity: balance.availableQuantity + quantity,
    reservedQuantity: balance.reservedQuantity - quantity,
  };
}

export function commitInventorySale(balance: InventoryBalance, quantity: number): InventoryBalance {
  assertInventoryBalance(balance);
  assertPositiveQuantity(quantity);
  assertReservedQuantity(balance, quantity);

  return {
    availableQuantity: balance.availableQuantity,
    reservedQuantity: balance.reservedQuantity - quantity,
  };
}

export function adjustAvailableInventory(balance: InventoryBalance, quantityChange: number): InventoryBalance {
  assertInventoryBalance(balance);

  if (!Number.isSafeInteger(quantityChange) || quantityChange === 0) {
    throwInvalidInventoryQuantity("quantityChange must be a non-zero integer.");
  }

  const availableQuantity = balance.availableQuantity + quantityChange;
  if (availableQuantity < 0) {
    throwInvalidInventoryQuantity("Inventory adjustment cannot make availableQuantity negative.");
  }
  // Inventory quantities are persisted as PostgreSQL int4.
  if (availableQuantity > MAX_INVENTORY_QUANTITY) {
    throwInvalidInventoryQuantity("Inventory adjustment cannot exceed the maximum availableQuantity.");
  }

  return { availableQuantity, reservedQuantity: balance.reservedQuantity };
}

function assertInventoryBalance(balance: InventoryBalance): void {
  assertNonNegativeQuantity(balance.availableQuantity, "availableQuantity");
  assertNonNegativeQuantity(balance.reservedQuantity, "reservedQuantity");
}

function assertPositiveQuantity(quantity: number): void {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throwInvalidInventoryQuantity("quantity must be a positive integer.");
  }
}

function assertNonNegativeQuantity(quantity: number, fieldName: string): void {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throwInvalidInventoryQuantity(`${fieldName} must be a non-negative integer.`);
  }
}

function assertReservedQuantity(balance: InventoryBalance, quantity: number): void {
  if (quantity > balance.reservedQuantity) {
    throwInvalidInventoryQuantity("quantity cannot exceed reservedQuantity.");
  }
}

function throwInvalidInventoryQuantity(message: string): never {
  throw new ApplicationError({ code: "INVALID_INVENTORY_QUANTITY", message, statusCode: 400 });
}
