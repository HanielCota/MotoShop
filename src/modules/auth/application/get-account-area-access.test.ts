import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ membershipFindFirst: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/config/env", () => ({ env: { ADMIN_EMAILS: "admin@example.test" } }));
vi.mock("@/lib/database", () => ({ db: { sellerMember: { findFirst: mocks.membershipFindFirst } } }));
import { getAccountAreaAccess } from "./get-account-area-access";

const customer = { id: "user-a", email: "buyer@example.test", emailVerified: true };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.membershipFindFirst.mockResolvedValue(null);
});

describe("account area access", () => {
  it("gives a customer no area", async () => {
    await expect(getAccountAreaAccess(customer)).resolves.toEqual({ admin: false, seller: false });
  });

  it("recognizes a verified administrator e-mail, but not an unverified one", async () => {
    const admin = { ...customer, email: "ADMIN@example.test" };
    await expect(getAccountAreaAccess(admin)).resolves.toMatchObject({ admin: true });
    await expect(getAccountAreaAccess({ ...admin, emailVerified: false })).resolves.toMatchObject({ admin: false });
  });

  it("counts only memberships of the user in an approved or active seller with a store", async () => {
    mocks.membershipFindFirst.mockResolvedValue({ id: "member-a" });

    await expect(getAccountAreaAccess(customer)).resolves.toEqual({ admin: false, seller: true });
    expect(mocks.membershipFindFirst).toHaveBeenCalledWith({
      where: { userId: "user-a", seller: { status: { in: ["APPROVED", "ACTIVE"] }, store: { isNot: null } } },
      select: { id: true },
    });
  });
});
