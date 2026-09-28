import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ order: vi.fn(), cancellation: vi.fn(), dispute: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({
  db: {
    sellerOrder: { findFirst: mocks.order },
    cancellationRequest: { findUnique: mocks.cancellation },
    dispute: { findUnique: mocks.dispute },
  },
}));
import { requestCancellation } from "./request-cancellation";
import { requestDispute } from "@/modules/disputes/application/request-dispute";
const input = {
  orderNumber: "MS-1",
  sellerOrderId: "seller-order-1",
  reason: "Teste",
  description: "Teste de idempotência",
  idempotencyKey: "key",
  identity: { userId: "buyer" },
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.order.mockResolvedValue({ id: "seller-order-1", status: "CANCELLATION_REQUESTED", disputes: [] });
});
it.each([
  ["cancellation", requestCancellation, mocks.cancellation],
  ["dispute", requestDispute, mocks.dispute],
] as const)("binds a %s replay to the authorized seller order", async (_name, execute, mock) => {
  mock.mockResolvedValue({ id: "other-request", sellerOrderId: "another-order" });
  await expect(execute(input)).rejects.toThrow("outro pedido");
});
it("allows replay of a cancellation after the seller order changed status", async () => {
  const prior = { id: "prior", sellerOrderId: "seller-order-1" };
  mocks.cancellation.mockResolvedValue(prior);
  await expect(requestCancellation(input)).resolves.toEqual(prior);
});
