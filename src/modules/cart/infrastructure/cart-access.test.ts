import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  cookieGet: vi.fn(),
  cookieDelete: vi.fn(),
  cookieSet: vi.fn(),
  hasGuest: vi.fn(),
  merge: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookieGet, delete: mocks.cookieDelete, set: mocks.cookieSet }),
}));
vi.mock("@/config/env", () => ({ env: { NODE_ENV: "test" } }));
vi.mock("@/lib/database", () => ({ db: {} }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));
vi.mock("@/modules/auth/application/authorization", () => ({ getCurrentSession: mocks.session }));
vi.mock("../application/merge-guest-cart", () => ({
  cartLockKey: () => "lock",
  hasActiveGuestCart: mocks.hasGuest,
  mergeGuestCartIntoUserCart: mocks.merge,
}));

import { getCartIdentity, hashGuestToken } from "./cart-access";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user: { id: "user-1" } });
  mocks.cookieGet.mockReturnValue({ value: "guest-token" });
  mocks.hasGuest.mockResolvedValue(true);
  mocks.merge.mockResolvedValue({ merged: true, mergedVariants: 1, skippedVariants: 0 });
});

it("merges the guest cart into the signed-in user's cart and clears the guest cookie", async () => {
  expect(await getCartIdentity()).toEqual({ userId: "user-1" });
  expect(mocks.merge).toHaveBeenCalledWith({ userId: "user-1", guestAccessTokenHash: hashGuestToken("guest-token") });
  expect(mocks.cookieDelete).toHaveBeenCalledWith("motoshop_cart_token");
});

it("skips the merge transaction when the guest cart was already merged, still clearing the cookie", async () => {
  mocks.hasGuest.mockResolvedValue(false);
  await getCartIdentity();
  expect(mocks.merge).not.toHaveBeenCalled();
  expect(mocks.cookieDelete).toHaveBeenCalled();
});

it("keeps the account cart usable when cookies are read-only or the merge fails", async () => {
  mocks.cookieDelete.mockImplementation(() => {
    throw new Error("Cookies can only be modified in a Server Action or Route Handler.");
  });
  expect(await getCartIdentity()).toEqual({ userId: "user-1" });

  mocks.merge.mockRejectedValue(new Error("deadlock"));
  mocks.cookieDelete.mockReset();
  expect(await getCartIdentity()).toEqual({ userId: "user-1" });
  expect(mocks.cookieDelete).not.toHaveBeenCalled();
});

it("does not merge for visitors or for signed-in users without a guest cookie", async () => {
  mocks.session.mockResolvedValue(null);
  expect(await getCartIdentity()).toEqual({ guestAccessTokenHash: hashGuestToken("guest-token") });
  mocks.session.mockResolvedValue({ user: { id: "user-1" } });
  mocks.cookieGet.mockReturnValue(undefined);
  await getCartIdentity();
  expect(mocks.hasGuest).not.toHaveBeenCalled();
  expect(mocks.merge).not.toHaveBeenCalled();
});
