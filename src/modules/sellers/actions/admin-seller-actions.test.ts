import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), audit: vi.fn(), transaction: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireAdminAccess: async () => ({ user: { id: "admin" } }),
}));
vi.mock("@/lib/database", () => ({
  db: {
    seller: { findFirst: mocks.find, update: mocks.update },
    auditLog: { create: mocks.audit },
    $transaction: mocks.transaction,
  },
}));
import {
  approveSellerAction,
  rejectSellerAction,
  suspendSellerAction,
  reactivateSellerAction,
} from "./admin-seller-actions";
beforeEach(() => vi.resetAllMocks());
it.each([
  [approveSellerAction, "PENDING", "ACTIVE"],
  [rejectSellerAction, "PENDING", "REJECTED"],
  [suspendSellerAction, "ACTIVE", "SUSPENDED"],
  [reactivateSellerAction, "SUSPENDED", "ACTIVE"],
] as const)("conditions a seller transition on its original state", async (execute, previous, next) => {
  mocks.find.mockResolvedValue({ id: "cseller0001", status: previous });
  await execute("cseller0001");
  expect(mocks.update).toHaveBeenCalledWith({ where: { id: "cseller0001", status: previous }, data: { status: next } });
  expect(mocks.transaction).toHaveBeenCalled();
});
it("does not silently succeed on an invalid seller transition", async () => {
  mocks.find.mockResolvedValue(null);
  await expect(approveSellerAction("cseller0001")).rejects.toThrow("decisão");
  expect(mocks.update).not.toHaveBeenCalled();
});
it.each([
  [approveSellerAction, "ACTIVE"],
  [rejectSellerAction, "REJECTED"],
  [suspendSellerAction, "SUSPENDED"],
  [reactivateSellerAction, "ACTIVE"],
] as const)("treats a repeated decision (double click) as a no-op instead of failing", async (execute, target) => {
  mocks.find.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "cseller0001" });
  await expect(execute("cseller0001")).resolves.toBeUndefined();
  expect(mocks.find).toHaveBeenLastCalledWith({ where: { id: "cseller0001", status: target }, select: { id: true } });
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.audit).not.toHaveBeenCalled();
  expect(mocks.transaction).not.toHaveBeenCalled();
});
it.each([approveSellerAction, rejectSellerAction, suspendSellerAction, reactivateSellerAction])(
  "rejects a malformed seller id before reading the database",
  async (execute) => {
    await expect(execute("../x")).rejects.toMatchObject({ code: "VALIDATION_ERROR", message: "Loja inválida." });
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  },
);
