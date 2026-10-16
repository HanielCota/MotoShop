import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lock: vi.fn(),
  storeFind: vi.fn(),
  memberFind: vi.fn(),
  memberCreate: vi.fn(),
  memberDelete: vi.fn(),
  inviteFindFirst: vi.fn(),
  inviteFindUnique: vi.fn(),
  inviteCreate: vi.fn(),
  inviteUpdate: vi.fn(),
  inviteUpdateMany: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/config/get-application-base-url", () => ({ getApplicationBaseUrl: () => "https://moto.example.test" }));
vi.mock("@/lib/database", () => {
  const tx = {
    $queryRaw: mocks.lock,
    store: { findFirst: mocks.storeFind },
    sellerMember: { findFirst: mocks.memberFind, create: mocks.memberCreate, deleteMany: mocks.memberDelete },
    sellerMemberInvite: {
      findFirst: mocks.inviteFindFirst,
      findUnique: mocks.inviteFindUnique,
      create: mocks.inviteCreate,
      update: mocks.inviteUpdate,
      updateMany: mocks.inviteUpdateMany,
    },
    auditLog: { create: mocks.auditCreate },
  };
  return { db: { ...tx, $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) } };
});

import {
  acceptSellerMemberInvite,
  createSellerMemberInvite,
  getSellerInviteUrl,
  hashInviteToken,
  leaveSellerStore,
} from "./member-invites";

const now = new Date("2026-10-15T12:00:00Z");
const owner = { sellerId: "seller-a", actorUserId: "owner-a", actorRole: "OWNER" as const };
const account = { userId: "user-b", email: "pedro@oficina.com", emailVerified: true };
const pendingInvite = {
  id: "invite-1",
  sellerId: "seller-a",
  email: "pedro@oficina.com",
  role: "ORDERS" as const,
  status: "PENDING" as const,
  tokenHash: "hash",
  expiresAt: new Date("2026-10-20T12:00:00Z"),
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.storeFind.mockResolvedValue({ name: "Garagem MX" });
  mocks.memberFind.mockResolvedValue(null);
  mocks.inviteFindFirst.mockResolvedValue(null);
  mocks.inviteCreate.mockResolvedValue({ id: "invite-1" });
  mocks.inviteUpdate.mockResolvedValue({ id: "invite-1" });
  mocks.inviteUpdateMany.mockResolvedValue({ count: 1 });
  mocks.memberCreate.mockResolvedValue({ id: "member-b" });
});

describe("createSellerMemberInvite (M-04)", () => {
  it("stores only the token hash and audits the invite", async () => {
    const result = await createSellerMemberInvite(owner, { email: " Pedro@Oficina.com ", role: "ORDERS" }, now);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const data = mocks.inviteCreate.mock.calls[0]?.[0].data;
    expect(data).toMatchObject({ sellerId: "seller-a", email: "pedro@oficina.com", role: "ORDERS" });
    expect(data.tokenHash).toBe(hashInviteToken(result.token));
    expect(JSON.stringify(data)).not.toContain(result.token);
    expect(data.expiresAt.toISOString()).toBe("2026-10-22T12:00:00.000Z");
    expect(getSellerInviteUrl(result.token)).toBe(`https://moto.example.test/convite/${result.token}`);
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "SELLER_MEMBER_INVITED" }) }),
    );
  });

  it("renews the pending invite of the same e-mail instead of creating another", async () => {
    mocks.inviteFindFirst.mockResolvedValue({ id: "invite-1" });

    await createSellerMemberInvite(owner, { email: "pedro@oficina.com", role: "CATALOG" }, now);

    expect(mocks.inviteCreate).not.toHaveBeenCalled();
    expect(mocks.inviteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "invite-1" }, data: expect.objectContaining({ role: "CATALOG" }) }),
    );
  });

  it("keeps admin invites to the owner (L-17)", async () => {
    const result = await createSellerMemberInvite(
      { ...owner, actorRole: "ADMIN" },
      { email: "a@b.com", role: "ADMIN" },
    );

    expect(result).toEqual({ ok: false, error: "Só o responsável pela loja pode convidar administradores." });
    expect(mocks.inviteCreate).not.toHaveBeenCalled();
  });
});

describe("acceptSellerMemberInvite (M-04)", () => {
  it("creates the membership and consumes the invite in one transaction", async () => {
    mocks.inviteFindUnique.mockResolvedValue(pendingInvite);

    const result = await acceptSellerMemberInvite({ token: "t".repeat(43) }, account, now);

    expect(result).toEqual({ ok: true });
    expect(mocks.lock).toHaveBeenCalledOnce();
    expect(mocks.inviteUpdateMany).toHaveBeenCalledWith({
      where: { id: "invite-1", status: "PENDING", tokenHash: "hash" },
      data: { status: "ACCEPTED", respondedAt: now, acceptedByUserId: "user-b" },
    });
    expect(mocks.memberCreate).toHaveBeenCalledWith({
      data: { sellerId: "seller-a", userId: "user-b", role: "ORDERS" },
    });
  });

  it("answers the same message for another e-mail or an unverified account", async () => {
    mocks.inviteFindUnique.mockResolvedValue(pendingInvite);

    const otherEmail = await acceptSellerMemberInvite({ inviteId: "invite-1" }, { ...account, email: "x@y.com" }, now);
    const unverified = await acceptSellerMemberInvite(
      { inviteId: "invite-1" },
      { ...account, emailVerified: false },
      now,
    );

    expect(otherEmail).toEqual({ ok: false, error: "Este convite não está disponível para a sua conta." });
    expect(unverified).toEqual(otherEmail);
    expect(mocks.memberCreate).not.toHaveBeenCalled();
  });

  it("does not accept while the account already belongs to a store", async () => {
    mocks.inviteFindUnique.mockResolvedValue(pendingInvite);
    mocks.memberFind.mockResolvedValue({ id: "member-x" });

    const result = await acceptSellerMemberInvite({ inviteId: "invite-1" }, account, now);

    expect(result.ok).toBe(false);
    expect(mocks.inviteUpdateMany).not.toHaveBeenCalled();
  });
});

describe("leaveSellerStore (M-04)", () => {
  it("lets a team member leave and audits it", async () => {
    mocks.memberFind.mockResolvedValue({ id: "member-b", sellerId: "seller-a", role: "CATALOG" });
    mocks.memberDelete.mockResolvedValue({ count: 1 });

    expect(await leaveSellerStore("user-b")).toEqual({ ok: true });
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "SELLER_MEMBER_LEFT" }) }),
    );
  });

  it("never lets the owner leave", async () => {
    mocks.memberFind.mockResolvedValue({ id: "member-a", sellerId: "seller-a", role: "OWNER" });

    expect((await leaveSellerStore("owner-a")).ok).toBe(false);
    expect(mocks.memberDelete).not.toHaveBeenCalled();
  });
});
