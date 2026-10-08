import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    cart: { findFirst: vi.fn() },
    cartItem: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), update: vi.fn(), delete: vi.fn() },
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
import { addToCartAction, updateCartItemAction } from "./cart-actions";
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
    mocks.tx.cartItem.findUnique.mock.invocationCallOrder[0]!,
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
        product: expect.objectContaining({ status: "APPROVED", isDemo: false }),
      }),
    }),
  );
  expect(mocks.tx.cartItem.upsert).toHaveBeenCalled();
});
