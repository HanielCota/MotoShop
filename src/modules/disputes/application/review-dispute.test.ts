import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ find: vi.fn(), updateMany: vi.fn(), audit: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({
  db: {
    dispute: { findUnique: mocks.find },
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback({ $queryRaw: vi.fn(), dispute: { updateMany: mocks.updateMany }, auditLog: { create: mocks.audit } }),
  },
}));

import { reviewDispute } from "./review-dispute";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.find.mockResolvedValue({ status: "UNDER_REVIEW", order: { orderNumber: "MS-1" } });
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

it("resolves a dispute with an optimistic update and audit", async () => {
  await expect(
    reviewDispute({ disputeId: "d1", decision: "RESOLVE", note: "Reembolso parcial", actorUserId: "admin" }),
  ).resolves.toEqual({ nextStatus: "RESOLVED", orderNumber: "MS-1" });
  expect(mocks.updateMany).toHaveBeenCalledWith({
    where: { id: "d1", status: "UNDER_REVIEW" },
    data: { status: "RESOLVED", resolutionNote: "Reembolso parcial", resolvedByUserId: "admin" },
  });
  expect(mocks.audit).toHaveBeenCalledWith({
    data: expect.objectContaining({
      action: "DISPUTE_RESOLVED",
      metadata: { previousStatus: "UNDER_REVIEW", nextStatus: "RESOLVED", note: "Reembolso parcial" },
    }),
  });
});

it("requires a resolution note", async () => {
  await expect(reviewDispute({ disputeId: "d1", decision: "RESOLVE", actorUserId: "admin" })).rejects.toThrow(
    "Informe a resolução",
  );
  expect(mocks.find).not.toHaveBeenCalled();
});

it("does not set the resolver when only starting the review", async () => {
  mocks.find.mockResolvedValue({ status: "OPEN", order: { orderNumber: "MS-1" } });
  await reviewDispute({ disputeId: "d1", decision: "START_REVIEW", actorUserId: "admin" });
  expect(mocks.updateMany).toHaveBeenCalledWith({
    where: { id: "d1", status: "OPEN" },
    data: { status: "UNDER_REVIEW" },
  });
});

it("fails without auditing when another operation changed the dispute", async () => {
  mocks.updateMany.mockResolvedValue({ count: 0 });
  await expect(reviewDispute({ disputeId: "d1", decision: "REJECT", actorUserId: "admin" })).rejects.toThrow(
    "outra operação",
  );
  expect(mocks.audit).not.toHaveBeenCalled();
});

it("rejects invalid transitions before writing", async () => {
  mocks.find.mockResolvedValue({ status: "RESOLVED", order: { orderNumber: "MS-1" } });
  await expect(reviewDispute({ disputeId: "d1", decision: "REJECT", actorUserId: "admin" })).rejects.toThrow(
    "não é válida",
  );
  expect(mocks.updateMany).not.toHaveBeenCalled();
});
