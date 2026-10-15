import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lock: vi.fn(),
  userFind: vi.fn(),
  memberFind: vi.fn(),
  memberCreate: vi.fn(),
  memberUpdate: vi.fn(),
  memberDelete: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/database", () => ({ db: { $transaction: mocks.transaction } }));
vi.mock("server-only", () => ({}));
vi.mock("@/config/get-application-base-url", () => ({ getApplicationBaseUrl: () => "https://moto.example.test" }));
vi.mock("@/shared/rate-limit/consume-rate-limit", () => ({ consumeRateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("../application/send-seller-invite-email", () => ({ sendSellerInviteEmail: vi.fn() }));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireSellerAccess: vi.fn(async () => ({
    seller: { id: "seller-a" },
    session: { user: { id: "owner-a" } },
    membership: { role: "OWNER" },
  })),
}));

import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { removeSellerMemberAction, updateSellerMemberRoleAction } from "./seller-member-actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation((callback) =>
    callback({
      $queryRaw: mocks.lock,
      user: { findUnique: mocks.userFind },
      sellerMember: {
        findFirst: mocks.memberFind,
        create: mocks.memberCreate,
        updateMany: mocks.memberUpdate,
        deleteMany: mocks.memberDelete,
      },
      auditLog: { create: mocks.auditCreate },
    }),
  );
  mocks.userFind.mockResolvedValue({ id: "member-a", email: "member@example.test", emailVerified: true });
  mocks.memberFind.mockResolvedValue({ id: "cmemberlinka0000000000001", userId: "member-a", role: "CATALOG" });
  mocks.memberCreate.mockResolvedValue({ id: "cmemberlinka0000000000001" });
  mocks.memberUpdate.mockResolvedValue({ count: 1 });
  mocks.memberDelete.mockResolvedValue({ count: 1 });
});

describe("seller member audit transactions", () => {
  it("updates a member role and its audit record in one tenant-scoped transaction", async () => {
    const form = new FormData();
    form.set("role", "ADMIN");

    await updateSellerMemberRoleAction("cmemberlinka0000000000001", form);

    expect(mocks.memberFind).toHaveBeenCalledWith({ where: { id: "cmemberlinka0000000000001", sellerId: "seller-a" } });
    expect(mocks.memberUpdate).toHaveBeenCalledWith({
      where: { id: "cmemberlinka0000000000001", sellerId: "seller-a", role: "CATALOG" },
      data: { role: "ADMIN" },
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "SELLER_MEMBER_ROLE_UPDATED",
          metadata: expect.objectContaining({ previousRole: "CATALOG", nextRole: "ADMIN" }),
        }),
      }),
    );
  });

  it("removes a member and its audit record in one tenant-scoped transaction", async () => {
    await removeSellerMemberAction("cmemberlinka0000000000001");

    expect(mocks.memberDelete).toHaveBeenCalledWith({
      where: { id: "cmemberlinka0000000000001", sellerId: "seller-a", role: "CATALOG" },
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "SELLER_MEMBER_REMOVED" }) }),
    );
  });

  it("never changes or removes the owner membership", async () => {
    mocks.memberFind.mockResolvedValue({ id: "cownerlink000000000000002", userId: "owner-a", role: "OWNER" });
    const form = new FormData();
    form.set("role", "ADMIN");

    await updateSellerMemberRoleAction("cownerlink000000000000002", form);
    await removeSellerMemberAction("cownerlink000000000000002");

    expect(mocks.memberUpdate).not.toHaveBeenCalled();
    expect(mocks.memberDelete).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("does not change or remove a member that belongs to another seller", async () => {
    mocks.memberFind.mockResolvedValue(null);
    const form = new FormData();
    form.set("role", "ADMIN");

    await updateSellerMemberRoleAction("cmemberlinkb0000000000003", form);
    await removeSellerMemberAction("cmemberlinkb0000000000003");

    expect(mocks.memberFind).toHaveBeenCalledWith({ where: { id: "cmemberlinkb0000000000003", sellerId: "seller-a" } });
    expect(mocks.memberUpdate).not.toHaveBeenCalled();
    expect(mocks.memberDelete).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("requires SELLER_MANAGE before opening a member transaction", async () => {
    vi.mocked(requireSellerAccess)
      .mockRejectedValueOnce(new Error("FORBIDDEN"))
      .mockRejectedValueOnce(new Error("FORBIDDEN"));
    const form = new FormData();
    form.set("role", "ADMIN");

    await expect(updateSellerMemberRoleAction("cmemberlinka0000000000001", form)).rejects.toThrow("FORBIDDEN");
    await expect(removeSellerMemberAction("cmemberlinka0000000000001")).rejects.toThrow("FORBIDDEN");

    expect(requireSellerAccess).toHaveBeenCalledWith("SELLER_MANAGE");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("seller member id validation", () => {
  it("ignores malformed member ids before opening a transaction", async () => {
    const form = new FormData();
    form.set("role", "ORDERS");

    await updateSellerMemberRoleAction("not a cuid", form);
    await removeSellerMemberAction("../member");

    expect(mocks.memberFind).not.toHaveBeenCalled();
  });
});

describe("seller admin management is reserved to the owner (L-17)", () => {
  const adminContext = {
    seller: { id: "seller-a" },
    session: { user: { id: "admin-a" } },
    membership: { role: "ADMIN" },
  };

  it("does not let an admin demote or remove another admin", async () => {
    vi.mocked(requireSellerAccess)
      .mockResolvedValueOnce(adminContext as never)
      .mockResolvedValueOnce(adminContext as never);
    mocks.memberFind.mockResolvedValue({ id: "cmemberlinka0000000000001", userId: "member-a", role: "ADMIN" });
    const form = new FormData();
    form.set("role", "CATALOG");

    await updateSellerMemberRoleAction("cmemberlinka0000000000001", form);
    await removeSellerMemberAction("cmemberlinka0000000000001");

    expect(mocks.memberUpdate).not.toHaveBeenCalled();
    expect(mocks.memberDelete).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("does not let an admin promote an operational member to admin", async () => {
    vi.mocked(requireSellerAccess).mockResolvedValueOnce(adminContext as never);
    const form = new FormData();
    form.set("role", "ADMIN");

    await updateSellerMemberRoleAction("cmemberlinka0000000000001", form);

    expect(mocks.memberUpdate).not.toHaveBeenCalled();
  });

  it("still lets an admin manage operational roles", async () => {
    vi.mocked(requireSellerAccess).mockResolvedValueOnce(adminContext as never);
    const form = new FormData();
    form.set("role", "ORDERS");

    await updateSellerMemberRoleAction("cmemberlinka0000000000001", form);

    expect(mocks.memberUpdate).toHaveBeenCalledWith({
      where: { id: "cmemberlinka0000000000001", sellerId: "seller-a", role: "CATALOG" },
      data: { role: "ORDERS" },
    });
  });
});
