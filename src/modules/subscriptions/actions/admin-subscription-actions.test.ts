import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ lock: vi.fn(), seller: vi.fn(), subscription: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireAdminAccess: async () => ({ user: { id: "admin" } }),
}));
vi.mock("@/lib/database", () => ({
  db: {
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback({
        $queryRaw: mocks.lock,
        seller: { findFirst: mocks.seller },
        sellerSubscription: { findFirst: mocks.subscription },
      }),
  },
}));
import { activateVipSubscriptionAction } from "./admin-subscription-actions";
it("locks the seller before checking VIP state and rejects an unavailable seller", async () => {
  mocks.seller.mockResolvedValue(null);
  const form = new FormData();
  form.set("sellerId", "seller");
  form.set("months", "1");
  expect((await activateVipSubscriptionAction({}, form)).error).toContain("não encontrado");
  expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(mocks.seller.mock.invocationCallOrder[0]!);
  expect(mocks.subscription).not.toHaveBeenCalled();
});
