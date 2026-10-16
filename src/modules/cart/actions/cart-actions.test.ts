import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-vercel-forwarded-for": "203.0.113.7" }) }));
vi.mock("@/shared/rate-limit/consume-rate-limit", () => ({ assertRateLimit: vi.fn() }));
const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    cart: { findFirst: vi.fn() },
    cartItem: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  return { tx, variant: vi.fn() };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/database", () => ({
  db: {
    productVariant: { findFirst: mocks.variant },
    $transaction: async (callback: (tx: unknown) => unknown) => callback(mocks.tx),
  },
}));
vi.mock("../infrastructure/cart-access", () => ({
  getCartIdentity: async () => ({ userId: "buyer" }),
  cartOwnerWhere: () => ({ userId: "buyer" }),
  findOrCreateActiveCart: async () => ({ id: "cart" }),
}));
import { addToCartAction, clearCartAction, updateCartItemAction } from "./cart-actions";
const id = "cmf8w8m4p0000s6o5zj2q8v3k";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.variant.mockResolvedValue({ inventory: { availableQuantity: 1000 } });
  mocks.tx.cart.findFirst.mockResolvedValue({ id: "cart" });
  mocks.tx.cartItem.findUnique.mockResolvedValue({ quantity: 99 });
});
it("enforces the limit on the combined quantity, not just the incoming increment", async () => {
  expect((await addToCartAction(id, 1)).error).toContain("99");
  expect(mocks.tx.cartItem.upsert).not.toHaveBeenCalled();
  expect(mocks.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
    defined(mocks.tx.cartItem.findUnique.mock.invocationCallOrder[0]),
  );
});
it("does not add items after checkout converted the cart", async () => {
  mocks.tx.cart.findFirst.mockResolvedValue(null);
  expect((await addToCartAction(id, 1)).error).toContain("finalizado");
  expect(mocks.tx.cartItem.upsert).not.toHaveBeenCalled();
});
it("rechecks cart ownership and active state after waiting for its lock", async () => {
  mocks.tx.cartItem.findFirst.mockResolvedValueOnce({ cartId: "cart" }).mockResolvedValueOnce(null);
  expect((await updateCartItemAction(id, 2)).error).toContain("não encontrado");
  expect(mocks.tx.cartItem.update).not.toHaveBeenCalled();
  expect(mocks.tx.cartItem.findFirst).toHaveBeenLastCalledWith(
    expect.objectContaining({ where: { id, cart: { userId: "buyer", status: "ACTIVE" } } }),
  );
});
it("uses the shared purchasable-variant rule when adding", async () => {
  mocks.tx.cartItem.findUnique.mockResolvedValue(null);
  await addToCartAction(id, 1);
  expect(mocks.variant).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        id,
        active: true,
        product: expect.objectContaining({ status: "APPROVED" }),
      }),
    }),
  );
  expect(mocks.tx.cartItem.upsert).toHaveBeenCalled();
});
it("clears only the current owner's active cart, after locking it", async () => {
  mocks.tx.cartItem.deleteMany.mockResolvedValue({ count: 2 });
  expect(await clearCartAction()).toEqual({ success: "Carrinho limpo." });
  expect(mocks.tx.cart.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({ where: { userId: "buyer", status: "ACTIVE" } }),
  );
  expect(mocks.tx.cartItem.deleteMany).toHaveBeenCalledWith({
    where: { cartId: "cart", cart: { userId: "buyer", status: "ACTIVE" } },
  });
  expect(mocks.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
    defined(mocks.tx.cartItem.deleteMany.mock.invocationCallOrder[0]),
  );
});
it("does nothing when there is no active cart to clear", async () => {
  mocks.tx.cart.findFirst.mockResolvedValue(null);
  expect((await clearCartAction()).success).toBe("Carrinho limpo.");
  expect(mocks.tx.cartItem.deleteMany).not.toHaveBeenCalled();
});

function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Expected value to be defined");
  return value;
}

it("limits adding to the cart per client IP, since each cookie-less call opens a new cart (M-06)", async () => {
  const { assertRateLimit } = await import("@/shared/rate-limit/consume-rate-limit");

  await addToCartAction("cm123456789012345678901234", 1);

  expect(assertRateLimit).toHaveBeenCalledWith({ key: "cart-add:ip:203.0.113.7", windowSeconds: 60, max: 60 });
});
