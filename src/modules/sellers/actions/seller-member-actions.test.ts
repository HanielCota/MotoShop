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

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/database", () => ({ db: { $transaction: mocks.transaction } }));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireSellerAccess: vi.fn(async () => ({
    seller: { id: "seller-a" },
    session: { user: { id: "owner-a" } },
  })),
}));

import { addSellerMemberAction, removeSellerMemberAction, updateSellerMemberRoleAction } from "./seller-member-actions";

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

function memberForm() {
  const form = new FormData();
  form.set("email", "member@example.test");
  form.set("role", "CATALOG");
  return form;
}

describe("seller member audit transactions", () => {
  it("adds a member and its audit record in one transaction", async () => {
    mocks.memberFind.mockResolvedValue(null);
    const result = await addSellerMemberAction({}, memberForm());

    expect(result.success).toContain("foi adicionado");
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.lock).toHaveBeenCalledOnce();
    expect(mocks.memberCreate).toHaveBeenCalledWith({
      data: { sellerId: "seller-a", userId: "member-a", role: "CATALOG" },
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "SELLER_MEMBER_ADDED" }) }),
    );
  });

  it("does not add a user whose e-mail is not verified", async () => {
    mocks.memberFind.mockResolvedValue(null);
    mocks.userFind.mockResolvedValue({ id: "member-a", email: "member@example.test", emailVerified: false });
    const result = await addSellerMemberAction({}, memberForm());

    expect(result.error).toContain("confirmar o e-mail");
    expect(mocks.memberCreate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

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
