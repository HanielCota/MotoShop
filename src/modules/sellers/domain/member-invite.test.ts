import { describe, expect, it } from "vitest";

import { canUseSellerInvite, getSellerInviteDaysLeft, getSellerInviteExpiry } from "./member-invite";

const now = new Date("2026-10-15T12:00:00Z");
const invite = { status: "PENDING" as const, expiresAt: getSellerInviteExpiry(now), email: "pedro@oficina.com" };
const account = { email: "Pedro@Oficina.com", emailVerified: true };

describe("seller member invite", () => {
  it("expires seven days after it is created", () => {
    expect(invite.expiresAt.toISOString()).toBe("2026-10-22T12:00:00.000Z");
    expect(getSellerInviteDaysLeft(invite.expiresAt, now)).toBe(7);
  });

  it("accepts only the verified account of the invited e-mail", () => {
    expect(canUseSellerInvite(invite, account, now)).toBe(true);
    expect(canUseSellerInvite(invite, { ...account, emailVerified: false }, now)).toBe(false);
    expect(canUseSellerInvite(invite, { ...account, email: "outra@oficina.com" }, now)).toBe(false);
  });

  it("refuses used, revoked or expired invites", () => {
    expect(canUseSellerInvite({ ...invite, status: "ACCEPTED" }, account, now)).toBe(false);
    expect(canUseSellerInvite({ ...invite, status: "REVOKED" }, account, now)).toBe(false);
    expect(canUseSellerInvite(invite, account, new Date("2026-10-22T12:00:00Z"))).toBe(false);
  });
});
