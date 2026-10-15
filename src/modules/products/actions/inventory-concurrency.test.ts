import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  lock: vi.fn(),
  read: vi.fn(),
  update: vi.fn(),
  movement: vi.fn(),
  bumpProduct: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
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
function firstCall(mock: { mock: { invocationCallOrder: number[] } }) {
  const order = mock.mock.invocationCallOrder[0];
  if (order === undefined) throw new Error("Expected the mock to have been called");
  return order;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.read.mockResolvedValue({ id: "inv", availableQuantity: 3, reservedQuantity: 2 });
});
it("locks before reading and updating an inventory balance", async () => {
  await expect(adjustInventoryAction("cvariant0001", { kind: "IN", quantity: 2 })).resolves.toHaveProperty("success");
  expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(firstCall(mocks.read));
  expect(mocks.read).toHaveBeenCalledWith({ where: { variantId: "cvariant0001", sellerId: "seller-a" } });
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
  expect((await adjustInventoryAction("cvariant0002", { kind: "IN", quantity: 2 })).error).toContain("não encontrado");
  expect(mocks.update).not.toHaveBeenCalled();
});

it("invalidates open editors of an editable product before locking the inventory", async () => {
  await expect(adjustInventoryAction("cvariant0001", { kind: "IN", quantity: 2 })).resolves.toHaveProperty("success");
  expect(mocks.bumpProduct).toHaveBeenCalledWith({
    where: {
      sellerId: "seller-a",
      status: { in: ["DRAFT", "REJECTED"] },
      variants: { some: { id: "cvariant0001", sellerId: "seller-a" } },
    },
    data: { updatedAt: expect.any(Date) },
  });
  expect(mocks.bumpProduct.mock.invocationCallOrder[0]).toBeLessThan(firstCall(mocks.lock));
});
it("explains rejected adjustments in Portuguese", async () => {
  expect((await adjustInventoryAction("cvariant0001", { kind: "OUT", quantity: 4 })).error).toBe(
    "O ajuste deixaria o estoque negativo ou acima do limite permitido.",
  );
  expect((await adjustInventoryAction("cvariant0001", { kind: "IN", quantity: 2 ** 31 })).error).toBe(
    "O ajuste deixaria o estoque negativo ou acima do limite permitido.",
  );
  expect(mocks.update).not.toHaveBeenCalled();
});
it("rejects a malformed variant id before touching the inventory", async () => {
  expect(await adjustInventoryAction("../x", { kind: "IN", quantity: 2 })).toEqual({ error: "Variação inválida." });
  expect(mocks.lock).not.toHaveBeenCalled();
  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});

it("corrects the stock to the counted total under the lock (UX-10)", async () => {
  await expect(
    adjustInventoryAction("cvariant0001", { kind: "CORRECTION", quantity: 5, note: "Contagem de sexta" }),
  ).resolves.toHaveProperty("success");
  expect(mocks.update).toHaveBeenCalledWith({
    where: { id: "inv" },
    data: { availableQuantity: 5, version: { increment: 1 } },
  });
  expect(mocks.movement).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ type: "CORRECTION", quantityChange: 2, reason: "Contagem de sexta" }),
    }),
  );
});

it("refuses a correction that does not change the stock", async () => {
  expect((await adjustInventoryAction("cvariant0001", { kind: "CORRECTION", quantity: 3 })).error).toBe(
    "O estoque já está com essa quantidade.",
  );
  expect(mocks.update).not.toHaveBeenCalled();
});

it("validates the adjustment payload on the server", async () => {
  expect((await adjustInventoryAction("cvariant0001", { kind: "IN", quantity: 0 })).error).toBe(
    "Informe uma quantidade maior que zero.",
  );
  expect((await adjustInventoryAction("cvariant0001", { kind: "SET", quantity: 1 })).error).toBe(
    "Escolha o tipo de ajuste.",
  );
  expect(mocks.lock).not.toHaveBeenCalled();
});
