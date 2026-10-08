import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  lock: vi.fn(),
  read: vi.fn(),
  update: vi.fn(),
  movement: vi.fn(),
  bumpProduct: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireSellerAccess: vi.fn(async () => ({ seller: { id: "seller-a" }, session: { user: { id: "owner" } } })),
  requireAdminAccess: vi.fn(),
}));
vi.mock("@/lib/database", () => ({
  db: {
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback({
        $queryRaw: mocks.lock,
        product: { updateMany: mocks.bumpProduct },
        inventory: { findFirst: mocks.read, update: mocks.update },
        inventoryMovement: { create: mocks.movement },
      }),
  },
}));
import { adjustInventoryAction } from "./product-actions";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.read.mockResolvedValue({ id: "inv", availableQuantity: 3, reservedQuantity: 2 });
});
it("locks before reading and updating an inventory balance", async () => {
  await expect(adjustInventoryAction("variant", 2)).resolves.toHaveProperty("success");
  expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(mocks.read.mock.invocationCallOrder[0]!);
  expect(mocks.read).toHaveBeenCalledWith({ where: { variantId: "variant", sellerId: "seller-a" } });
  expect(mocks.update).toHaveBeenCalledWith({
    where: { id: "inv" },
    data: { availableQuantity: 5, version: { increment: 1 } },
  });
  expect(mocks.movement).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ reservedQuantityAfter: 2, availableQuantityAfter: 5 }) }),
  );
});
it("does not change another seller's inventory", async () => {
  mocks.read.mockResolvedValue(null);
  expect((await adjustInventoryAction("other-variant", 2)).error).toContain("não encontrado");
  expect(mocks.update).not.toHaveBeenCalled();
});

it("invalidates open editors of an editable product before locking the inventory", async () => {
  await expect(adjustInventoryAction("variant", 2)).resolves.toHaveProperty("success");
  expect(mocks.bumpProduct).toHaveBeenCalledWith({
    where: {
      sellerId: "seller-a",
      status: { in: ["DRAFT", "REJECTED"] },
      variants: { some: { id: "variant", sellerId: "seller-a" } },
    },
    data: { updatedAt: expect.any(Date) },
  });
  expect(mocks.bumpProduct.mock.invocationCallOrder[0]).toBeLessThan(mocks.lock.mock.invocationCallOrder[0]!);
});
it("explains rejected adjustments in Portuguese", async () => {
  expect((await adjustInventoryAction("variant", -4)).error).toBe(
    "O ajuste deixaria o estoque negativo ou acima do limite permitido.",
  );
  expect((await adjustInventoryAction("variant", 2 ** 31)).error).toBe(
    "O ajuste deixaria o estoque negativo ou acima do limite permitido.",
  );
  expect(mocks.update).not.toHaveBeenCalled();
});
