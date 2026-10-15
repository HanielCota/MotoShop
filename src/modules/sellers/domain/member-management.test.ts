import { expect, it } from "vitest";

import { canManageSellerMember } from "./member-management";

it("lets the owner manage admins and operational roles", () => {
  expect(canManageSellerMember({ actorRole: "OWNER", currentRole: null, nextRole: "ADMIN" })).toBe(true);
  expect(canManageSellerMember({ actorRole: "OWNER", currentRole: "ADMIN", nextRole: "CATALOG" })).toBe(true);
  expect(canManageSellerMember({ actorRole: "OWNER", currentRole: "ADMIN", nextRole: null })).toBe(true);
});

it("keeps admins away from other admins and from promoting anyone to admin", () => {
  expect(canManageSellerMember({ actorRole: "ADMIN", currentRole: null, nextRole: "ADMIN" })).toBe(false);
  expect(canManageSellerMember({ actorRole: "ADMIN", currentRole: "CATALOG", nextRole: "ADMIN" })).toBe(false);
  expect(canManageSellerMember({ actorRole: "ADMIN", currentRole: "ADMIN", nextRole: "ORDERS" })).toBe(false);
  expect(canManageSellerMember({ actorRole: "ADMIN", currentRole: "ADMIN", nextRole: null })).toBe(false);
});

it("lets an admin manage operational roles", () => {
  expect(canManageSellerMember({ actorRole: "ADMIN", currentRole: null, nextRole: "ORDERS" })).toBe(true);
  expect(canManageSellerMember({ actorRole: "ADMIN", currentRole: "CATALOG", nextRole: "FINANCE" })).toBe(true);
  expect(canManageSellerMember({ actorRole: "ADMIN", currentRole: "FINANCE", nextRole: null })).toBe(true);
});

it("never touches the owner membership and never lets other roles manage the team", () => {
  expect(canManageSellerMember({ actorRole: "OWNER", currentRole: "OWNER", nextRole: "ADMIN" })).toBe(false);
  expect(canManageSellerMember({ actorRole: "OWNER", currentRole: "ADMIN", nextRole: "OWNER" })).toBe(false);
  expect(canManageSellerMember({ actorRole: "CATALOG", currentRole: null, nextRole: "ORDERS" })).toBe(false);
});
