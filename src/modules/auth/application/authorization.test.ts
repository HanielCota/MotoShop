import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), membershipFindFirst: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock("@/config/env", () => ({ env: { ADMIN_EMAILS: "admin@example.test" } }));
vi.mock("@/lib/database", () => ({ db: { sellerMember: { findFirst: mocks.membershipFindFirst } } }));
vi.mock("@/modules/auth/infrastructure/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
import { requireAdminAccess, requireSellerAccess } from "./authorization";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { id: "member-a", email: "member@example.test", emailVerified: true } });
  mocks.membershipFindFirst.mockResolvedValue({
    role: "ORDERS",
    seller: { id: "seller-a", store: { id: "store-a" } },
  });
});
describe("administrator authorization", () => {
  it("denies unverified allowlisted email", async () => {
    mocks.session.mockResolvedValue({ user: { email: "admin@example.test", emailVerified: false } });
    await expect(requireAdminAccess()).rejects.toThrow("redirect:/forbidden");
  });
  it("denies verified users outside the allowlist", async () => {
    mocks.session.mockResolvedValue({ user: { email: "other@example.test", emailVerified: true } });
    await expect(requireAdminAccess()).rejects.toThrow("redirect:/forbidden");
  });
  it("accepts verified allowlisted users", async () => {
    const session = { user: { email: "ADMIN@example.test", emailVerified: true } };
    mocks.session.mockResolvedValue(session);
    await expect(requireAdminAccess()).resolves.toEqual(session);
  });
});

describe("seller authorization", () => {
  it("resolves the active seller membership by session user and checks the requested permission", async () => {
    const result = await requireSellerAccess("ORDER_READ");

    expect(result.seller.id).toBe("seller-a");
    expect(mocks.membershipFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "member-a", seller: { status: { in: ["APPROVED", "ACTIVE"] } } },
      }),
    );
  });

  it("denies a seller member whose role lacks the requested permission", async () => {
    await expect(requireSellerAccess("FINANCE_READ")).rejects.toThrow("redirect:/seller?error=permission");
  });

  it("sends users without an active store membership to onboarding", async () => {
    mocks.membershipFindFirst.mockResolvedValue(null);

    await expect(requireSellerAccess()).rejects.toThrow("redirect:/seller");
  });
});
