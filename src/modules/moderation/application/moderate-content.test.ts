import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findQuestion: vi.fn(), updateQuestion: vi.fn(), audit: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({
  db: {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        productQuestion: { findUnique: mocks.findQuestion, updateMany: mocks.updateQuestion },
        auditLog: { create: mocks.audit },
      }),
  },
}));

import { moderateContent } from "./moderate-content";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findQuestion.mockResolvedValue({ product: { slug: "capacete" } });
  mocks.updateQuestion.mockResolvedValue({ count: 1 });
});

describe("content moderation", () => {
  it("hides a question and audits the same transaction", async () => {
    await expect(
      moderateContent({ kind: "question", id: "question-a", hide: true, actorUserId: "admin-a" }),
    ).resolves.toEqual({ path: "/products/capacete" });
    expect(mocks.updateQuestion).toHaveBeenCalledWith({
      where: { id: "question-a", hiddenAt: null },
      data: { hiddenAt: expect.any(Date) },
    });
    expect(mocks.audit).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "PUBLIC_CONTENT_HIDDEN", actorUserId: "admin-a" }),
    });
  });

  it("does not audit a concurrent state change", async () => {
    mocks.updateQuestion.mockResolvedValue({ count: 0 });
    await expect(
      moderateContent({ kind: "question", id: "question-a", hide: true, actorUserId: "admin-a" }),
    ).rejects.toThrow(/mudou de estado/);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
