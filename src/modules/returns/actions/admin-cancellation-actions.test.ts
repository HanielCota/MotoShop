import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), audit: vi.fn(), refund: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireAdminAccess: async () => ({ user: { id: "admin" } }),
}));
vi.mock("@/modules/payments/application/refund-payment", () => ({ refundPayment: mocks.refund }));
vi.mock("@/lib/database", () => ({
  db: {
    cancellationRequest: { findUnique: mocks.find },
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback({ cancellationRequest: { updateMany: mocks.update }, auditLog: { create: mocks.audit } }),
  },
}));
import { reviewCancellationRequestAction } from "./admin-cancellation-actions";
it("does not refund a cancellation rejected by another administrator in the meantime", async () => {
  mocks.find.mockResolvedValue({
    id: "request",
    status: "REQUESTED",
    amountInCents: 100,
    sellerOrder: { status: "CANCELLATION_REQUESTED", shipment: null },
    order: { orderNumber: "MS-1" },
  });
  mocks.update.mockResolvedValue({ count: 0 });
  const form = new FormData();
  form.set("decision", "APPROVE");
  expect((await reviewCancellationRequestAction("request", form)).error).toContain("já foi decidida");
  expect(mocks.refund).not.toHaveBeenCalled();
  expect(mocks.audit).not.toHaveBeenCalled();
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "request", status: "REQUESTED" } }));
});
