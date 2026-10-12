import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), update: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/auth/application/authorization", () => ({ requireAdminAccess: mocks.authorize }));
vi.mock("@/lib/database", () => ({
  db: {
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback({ seller: { updateMany: mocks.update }, auditLog: { create: mocks.audit } }),
  },
}));
import { updateSellerCommissionAction } from "./seller-commission-actions";

const sellerId = "cmf8w8m4p0000s6o5zj2q8v3k";
function form(value: string, previous = "") {
  const data = new FormData();
  data.set("commissionPercent", value);
  data.set("previousCommissionPercent", previous);
  return data;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorize.mockResolvedValue({ user: { id: "admin-a" } });
  mocks.update.mockResolvedValue({ count: 1 });
});
describe("seller commission administration", () => {
  it("saves fractional percentages as integer basis points and audits the change", async () => {
    const result = await updateSellerCommissionAction(sellerId, {}, form("10,50"));
    expect(result.savedValue).toBe(1050);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: sellerId, commissionBpsOverride: null },
      data: { commissionBpsOverride: 1050 },
    });
    expect(mocks.audit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "admin-a",
        metadata: { previousCommissionBps: null, nextCommissionBps: 1050 },
      }),
    });
  });
  it("distinguishes zero commission from inheritance", async () => {
    expect((await updateSellerCommissionAction(sellerId, {}, form("0"))).savedValue).toBe(0);
    expect((await updateSellerCommissionAction(sellerId, {}, form("", "0"))).savedValue).toBeNull();
  });
  it.each(["-1", "100,01", "10,123", "abc", "1e2"])("rejects invalid commission %s", async (value) => {
    expect((await updateSellerCommissionAction(sellerId, {}, form(value))).error).toBeTruthy();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects stale edits without recording a false audit", async () => {
    mocks.update.mockResolvedValue({ count: 0 });
    expect((await updateSellerCommissionAction(sellerId, {}, form("12", "10"))).error).toMatch(/mudou/);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("requires admin access before touching the database", async () => {
    mocks.authorize.mockRejectedValue(new Error("FORBIDDEN"));
    await expect(updateSellerCommissionAction(sellerId, {}, form("12"))).rejects.toThrow("FORBIDDEN");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
