import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), audit: vi.fn(), restock: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/inventory/application/record-return-inventory", () => ({
  recordReturnedInventory: mocks.restock,
}));
vi.mock("@/lib/database", () => ({
  db: {
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback({
        $queryRaw: vi.fn(),
        returnRequest: { findUnique: mocks.find, update: mocks.update },
        auditLog: { create: mocks.audit },
      }),
  },
}));

import { reviewReturnRequest } from "./review-return";

const request = {
  id: "return",
  status: "APPROVED",
  items: [{ sellerId: "seller-1", quantity: 2, orderItem: { variantId: "variant-1" } }],
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.find.mockResolvedValue(request);
});

it("restores inventory and audits when the item is received", async () => {
  await expect(
    reviewReturnRequest({ returnRequestId: "return", decision: "RECEIVE", actorUserId: "admin" }),
  ).resolves.toEqual({ nextStatus: "RETURNED" });
  expect(mocks.restock).toHaveBeenCalledWith(
    expect.anything(),
    [{ variantId: "variant-1", sellerId: "seller-1", quantity: 2 }],
    "return",
    "admin",
  );
  expect(mocks.update).toHaveBeenCalledWith({ where: { id: "return" }, data: { status: "RETURNED" } });
  expect(mocks.audit).toHaveBeenCalledWith({
    data: expect.objectContaining({
      action: "RETURN_RETURNED",
      metadata: { previousStatus: "APPROVED", nextStatus: "RETURNED" },
    }),
  });
});

it("approves without touching inventory and stores the note", async () => {
  mocks.find.mockResolvedValue({ ...request, status: "REQUESTED" });
  await reviewReturnRequest({ returnRequestId: "return", decision: "APPROVE", note: "Ok", actorUserId: "admin" });
  expect(mocks.restock).not.toHaveBeenCalled();
  expect(mocks.update).toHaveBeenCalledWith({ where: { id: "return" }, data: { status: "APPROVED", adminNote: "Ok" } });
});

it("rejects an invalid transition without side effects", async () => {
  mocks.find.mockResolvedValue({ ...request, status: "REFUNDED" });
  await expect(
    reviewReturnRequest({ returnRequestId: "return", decision: "RECEIVE", actorUserId: "admin" }),
  ).rejects.toThrow("não é permitida");
  expect(mocks.restock).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.audit).not.toHaveBeenCalled();
});

it("fails when the request does not exist", async () => {
  mocks.find.mockResolvedValue(null);
  await expect(
    reviewReturnRequest({ returnRequestId: "return", decision: "APPROVE", actorUserId: "admin" }),
  ).rejects.toThrow("não encontrada");
});
