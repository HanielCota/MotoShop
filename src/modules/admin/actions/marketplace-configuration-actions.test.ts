import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  find: vi.fn(),
  upsert: vi.fn(),
  audit: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/modules/auth/application/authorization", () => ({ requireAdminAccess: mocks.authorize }));
vi.mock("@/lib/database", () => ({
  db: {
    $transaction: (callback: (tx: unknown) => unknown) =>
      callback({
        marketplaceConfiguration: { findUnique: mocks.find, upsert: mocks.upsert },
        auditLog: { create: mocks.audit },
      }),
  },
}));

import { updateMarketplaceCommissionAction } from "./marketplace-configuration-actions";

function form(value?: string) {
  const data = new FormData();
  if (value !== undefined) data.set("defaultCommissionBps", value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorize.mockResolvedValue({ user: { id: "admin-a" } });
  mocks.find.mockResolvedValue({ defaultCommissionBps: 1200 });
});

describe("marketplace default commission", () => {
  it.each([undefined, "", "-1", "10001", "1.5", "abc"])("rejects absent or invalid basis points: %s", async (value) => {
    expect((await updateMarketplaceCommissionAction({}, form(value))).error).toBeTruthy();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("allows an explicit zero and audits the prior value in the same transaction", async () => {
    expect((await updateMarketplaceCommissionAction({}, form("0"))).success).toBeTruthy();
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { key: "default" },
      create: { key: "default", defaultCommissionBps: 0 },
      update: { defaultCommissionBps: 0 },
    });
    expect(mocks.audit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "admin-a",
        metadata: { previousCommissionBps: 1200, nextCommissionBps: 0 },
      }),
    });
    expect(mocks.revalidate).toHaveBeenCalledWith("/admin", "layout");
  });

  it("does not report success when persistence fails", async () => {
    mocks.upsert.mockRejectedValueOnce(new Error("database unavailable"));
    expect((await updateMarketplaceCommissionAction({}, form("1500"))).error).toBeTruthy();
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("requires admin permission", async () => {
    mocks.authorize.mockRejectedValueOnce(new Error("FORBIDDEN"));
    await expect(updateMarketplaceCommissionAction({}, form("1500"))).rejects.toThrow("FORBIDDEN");
    expect(mocks.find).not.toHaveBeenCalled();
  });
});
