import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ find: vi.fn(), refund: vi.fn(), update: vi.fn(), audit: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireAdminAccess: async () => ({ user: { id: "admin" } }),
}));
vi.mock("@/modules/payments/application/refund-payment", () => ({ refundPayment: mocks.refund }));
vi.mock("@/lib/database", () => ({
  db: {
    returnRequest: { findUnique: mocks.find },
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback({ returnRequest: { updateMany: mocks.update }, auditLog: { create: mocks.audit } }),
  },
}));
import { refundReturnRequestAction } from "./admin-return-actions";
beforeEach(() => vi.resetAllMocks());
it("blocks old return requests whose item snapshots omitted a coupon", async () => {
  mocks.find.mockResolvedValue({
    id: "return",
    status: "RETURNED",
    amountInCents: 100,
    sellerOrder: { items: [{ totalAmountInCents: 100 }], itemsSubtotalInCents: 100, discountAmountInCents: 50 },
  });
  expect((await refundReturnRequestAction("return")).error).toContain("históricos");
  expect(mocks.refund).not.toHaveBeenCalled();
});
it("finishes a fully discounted return without sending a zero refund", async () => {
  mocks.find.mockResolvedValue({
    id: "return",
    status: "RETURNED",
    amountInCents: 0,
    order: { orderNumber: "MS-1" },
    sellerOrder: { items: [{ totalAmountInCents: 0 }], itemsSubtotalInCents: 100, discountAmountInCents: 100 },
  });
  mocks.update.mockResolvedValue({ count: 1 });
  expect((await refundReturnRequestAction("return")).success).toBeTruthy();
  expect(mocks.refund).not.toHaveBeenCalled();
  expect(mocks.audit).toHaveBeenCalled();
});
