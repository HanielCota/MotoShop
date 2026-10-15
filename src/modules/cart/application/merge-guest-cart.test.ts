import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  cart: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  cartItem: { findMany: vi.fn(), upsert: vi.fn() },
  productVariant: { findMany: vi.fn() },
}));
vi.mock("@/lib/database", () => ({
  db: { $transaction: async (callback: (client: unknown) => unknown) => callback(tx) },
}));

import { mergeGuestCartIntoUserCart } from "./merge-guest-cart";

type CartWhere = { where: { userId?: string | null; id?: string } };
type UpsertArgs = {
  where: { cartId_variantId: { cartId: string; variantId: string } };
  create: { cartId: string };
  update: { quantity: number };
};

const input = { userId: "user-1", guestAccessTokenHash: "guest-hash" };
const guestCart = {
  id: "guest-cart",
  items: [
    { variantId: "v-sum", quantity: 2 },
    { variantId: "v-stock-cap", quantity: 5 },
    { variantId: "v-limit-cap", quantity: 60 },
    { variantId: "v-demo", quantity: 1 },
    { variantId: "v-new", quantity: 1 },
  ],
};

function findCart(userCart: { id: string } | null) {
  return async ({ where }: CartWhere) => {
    if (where.userId === "user-1") return userCart;
    return where.id ? guestCart : { id: "guest-cart" };
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  tx.cart.findFirst.mockImplementation(findCart({ id: "user-cart" }));
  // v-demo is not returned: the purchasable predicate excludes it.
  tx.productVariant.findMany.mockResolvedValue([
    { id: "v-sum", inventory: { availableQuantity: 10 } },
    { id: "v-stock-cap", inventory: { availableQuantity: 4 } },
    { id: "v-limit-cap", inventory: { availableQuantity: 500 } },
    { id: "v-new", inventory: { availableQuantity: 3 } },
  ]);
  tx.cartItem.findMany.mockResolvedValue([
    { variantId: "v-sum", quantity: 1 },
    { variantId: "v-stock-cap", quantity: 1 },
    { variantId: "v-limit-cap", quantity: 50 },
  ]);
  tx.cart.updateMany.mockResolvedValue({ count: 1 });
});

function upsertCalls(): UpsertArgs[] {
  return tx.cartItem.upsert.mock.calls.map(([args]) => args as UpsertArgs);
}

function upsertedQuantities() {
  return Object.fromEntries(upsertCalls().map((args) => [args.where.cartId_variantId.variantId, args.update.quantity]));
}

it("sums quantities per variant, capped by stock and the 99-unit limit, skipping unpurchasable variants", async () => {
  const result = await mergeGuestCartIntoUserCart(input);
  expect(upsertedQuantities()).toEqual({ "v-sum": 3, "v-stock-cap": 4, "v-limit-cap": 99, "v-new": 1 });
  for (const args of upsertCalls()) expect(args.where.cartId_variantId.cartId).toBe("user-cart");
  expect(result).toEqual({ merged: true, mergedVariants: 4, skippedVariants: 1 });
});

it("checks variants with the shared purchasable predicate requiring stock", async () => {
  await mergeGuestCartIntoUserCart(input);
  const where = defined(tx.productVariant.findMany.mock.calls[0])[0].where;
  expect(where.OR[0]).toEqual(
    expect.objectContaining({
      active: true,
      inventory: { availableQuantity: { gt: 0 } },
      product: expect.objectContaining({ status: "APPROVED", isDemo: false }),
    }),
  );
});

it("locks both carts before reading items and only reads ownerless guest carts", async () => {
  await mergeGuestCartIntoUserCart(input);
  expect(tx.$queryRaw).toHaveBeenCalledTimes(4);
  expect(tx.$queryRaw.mock.invocationCallOrder[3]).toBeLessThan(
    defined(tx.productVariant.findMany.mock.invocationCallOrder[0]),
  );
  expect(tx.cart.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({ where: { guestAccessTokenHash: "guest-hash", userId: null, status: "ACTIVE" } }),
  );
});

it("marks the guest cart abandoned so a repeated merge is a no-op", async () => {
  await mergeGuestCartIntoUserCart(input);
  expect(tx.cart.updateMany).toHaveBeenCalledWith({
    where: { id: "guest-cart", userId: null, status: "ACTIVE" },
    data: { status: "ABANDONED" },
  });

  vi.clearAllMocks();
  tx.cart.findFirst.mockResolvedValue(null);
  expect(await mergeGuestCartIntoUserCart(input)).toEqual({ merged: false, mergedVariants: 0, skippedVariants: 0 });
  expect(tx.cartItem.upsert).not.toHaveBeenCalled();
  expect(tx.cart.updateMany).not.toHaveBeenCalled();
  expect(tx.cart.create).not.toHaveBeenCalled();
});

it("never lowers quantities the user already has", async () => {
  tx.cartItem.findMany.mockResolvedValue([{ variantId: "v-stock-cap", quantity: 4 }]);
  await mergeGuestCartIntoUserCart(input);
  expect(upsertedQuantities()["v-stock-cap"]).toBeUndefined();
});

it("creates the user's active cart when they have none", async () => {
  tx.cart.findFirst.mockImplementation(findCart(null));
  tx.cart.create.mockResolvedValue({ id: "new-user-cart" });
  await mergeGuestCartIntoUserCart(input);
  expect(tx.cart.create).toHaveBeenCalledWith(
    expect.objectContaining({ data: { userId: "user-1", status: "ACTIVE" } }),
  );
  expect(defined(upsertCalls()[0]).create.cartId).toBe("new-user-cart");
});

function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Expected value to be defined");
  return value;
}
