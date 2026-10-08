import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  auditCreate: vi.fn(),
  productFindFirst: vi.fn(),
  questionCreate: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  assertRateLimit: vi.fn(),
  requireSellerAccess: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/database", () => ({
  db: {
    product: { findFirst: mocks.productFindFirst },
    productQuestion: { create: mocks.questionCreate },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        productQuestion: { findFirst: mocks.findFirst, updateMany: mocks.updateMany },
        auditLog: { create: mocks.auditCreate },
      }),
    ),
  },
}));
vi.mock("@/shared/rate-limit/consume-rate-limit", () => ({ assertRateLimit: mocks.assertRateLimit }));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireSellerAccess: mocks.requireSellerAccess,
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

import { answerProductQuestionAction, askProductQuestionAction } from "./question-actions";

const QUESTION_ID = "cquestiona000000000000001";
const OTHER_QUESTION_ID = "cquestionsellerb000000002";
const PRODUCT_ID = "cproducta0000000000000001";

function answerForm(): FormData {
  const form = new FormData();
  form.set("answer", "Serve na CRF 250F 2025.");
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSellerAccess.mockResolvedValue({ seller: { id: "seller-a" }, session: { user: { id: "owner-a" } } });
  mocks.findFirst.mockResolvedValue({ id: QUESTION_ID, answer: null, product: { slug: "produto-a" } });
  mocks.requireAuthenticatedUser.mockResolvedValue({ user: { id: "buyer-a" } });
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

describe("product question seller isolation", () => {
  it("denies the action before database access when the seller lacks permission", async () => {
    mocks.requireSellerAccess.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(answerProductQuestionAction(QUESTION_ID, {}, answerForm())).rejects.toThrow("FORBIDDEN");

    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("does not change a question outside the seller scope", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const result = await answerProductQuestionAction(OTHER_QUESTION_ID, {}, answerForm());

    expect(result.error).toBe("Pergunta não encontrada.");
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: OTHER_QUESTION_ID, sellerId: "seller-a", hiddenAt: null } }),
    );
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("includes the seller and visibility conditions in the write", async () => {
    const result = await answerProductQuestionAction(QUESTION_ID, {}, answerForm());

    expect(result.success).toBe("Resposta publicada.");
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: QUESTION_ID, sellerId: "seller-a", hiddenAt: null, answer: null },
      data: expect.objectContaining({ answer: "Serve na CRF 250F 2025.", answeredByUserId: "owner-a" }),
    });
  });

  it("does not report success when moderation hides the question before the write", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });

    const result = await answerProductQuestionAction(QUESTION_ID, {}, answerForm());

    expect(result.error).toMatch(/não está mais disponível/);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects an empty answer before reading or writing a question", async () => {
    const form = new FormData();
    form.set("answer", "");

    const result = await answerProductQuestionAction(QUESTION_ID, {}, form);

    expect(result.error).toBe("Escreva uma resposta.");
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("audits an explicit edit of an existing answer", async () => {
    mocks.findFirst.mockResolvedValue({
      id: QUESTION_ID,
      answer: "Resposta antiga.",
      answeredByUserId: "member-b",
      product: { slug: "produto-a" },
    });

    const result = await answerProductQuestionAction(QUESTION_ID, {}, answerForm());

    expect(result.success).toBe("Resposta atualizada.");
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ answer: "Resposta antiga." }) }),
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "PRODUCT_QUESTION_ANSWER_UPDATED",
        entityId: QUESTION_ID,
        actorUserId: "owner-a",
        metadata: expect.objectContaining({
          previousAnswer: "Resposta antiga.",
          nextAnswer: "Serve na CRF 250F 2025.",
        }),
      }),
    });
  });

  it("does not audit the first answer", async () => {
    await answerProductQuestionAction(QUESTION_ID, {}, answerForm());
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("rejects a malformed question id before database access", async () => {
    const result = await answerProductQuestionAction("../x", {}, answerForm());
    expect(result.error).toBe("Pergunta não encontrada.");
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});

describe("asking product questions", () => {
  function questionForm() {
    const form = new FormData();
    form.set("question", "Serve na CRF 250F 2025?");
    return form;
  }

  it("only accepts approved products from approved or active sellers", async () => {
    mocks.productFindFirst.mockResolvedValue(null);

    const result = await askProductQuestionAction(PRODUCT_ID, {}, questionForm());

    expect(result.error).toBe("Produto não encontrado.");
    expect(mocks.productFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PRODUCT_ID, status: "APPROVED", seller: { status: { in: ["APPROVED", "ACTIVE"] } } },
      }),
    );
    expect(mocks.questionCreate).not.toHaveBeenCalled();
  });

  it("rejects a malformed product id without querying", async () => {
    const result = await askProductQuestionAction("not-an-id", {}, questionForm());
    expect(result.error).toBe("Produto não encontrado.");
    expect(mocks.productFindFirst).not.toHaveBeenCalled();
  });
});
