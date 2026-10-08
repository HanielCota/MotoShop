import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ review: vi.fn(), refund: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireAdminAccess: async () => ({ user: { id: "admin" } }),
}));
vi.mock("../application/review-return", () => ({ reviewReturnRequest: mocks.review }));
vi.mock("../application/refund-return", () => ({ refundReturnRequest: mocks.refund }));
import { ApplicationError } from "@/shared/errors/application-error";

import { refundReturnRequestAction, reviewReturnRequestAction } from "./admin-return-actions";

function form(decision: string, note?: string) {
  const data = new FormData();
  data.set("decision", decision);
  if (note) data.set("note", note);
  return data;
}

beforeEach(() => vi.resetAllMocks());

it("delegates the review decision to the application service", async () => {
  mocks.review.mockResolvedValue({ nextStatus: "REJECTED" });
  expect(await reviewReturnRequestAction("return", form("REJECT", "Fora do prazo"))).toEqual({
    success: "Solicitação atualizada.",
  });
  expect(mocks.review).toHaveBeenCalledWith({
    returnRequestId: "return",
    decision: "REJECT",
    note: "Fora do prazo",
    actorUserId: "admin",
  });
});

it("rejects an invalid decision without calling the service", async () => {
  expect(await reviewReturnRequestAction("return", form("MAYBE"))).toHaveProperty("error");
  expect(mocks.review).not.toHaveBeenCalled();
});

it("revalidates the order after a refund", async () => {
  mocks.refund.mockResolvedValue({ outcome: "REFUNDED", orderNumber: "MS-1" });
  expect(await refundReturnRequestAction("return")).toEqual({ success: "Reembolso processado." });
  expect(mocks.refund).toHaveBeenCalledWith({ returnRequestId: "return", actorUserId: "admin" });
  expect(mocks.revalidate).toHaveBeenCalledWith("/orders/MS-1");
});

it("maps application errors to a predictable action result", async () => {
  mocks.refund.mockRejectedValue(new ApplicationError({ code: "CONFLICT", message: "A devolução mudou de estado." }));
  expect((await refundReturnRequestAction("return")).error).toContain("mudou de estado");
});

it("keeps an unexpected refund failure retryable instead of leaking a generic English error", async () => {
  mocks.refund.mockRejectedValue(new Error("Mercado Pago request failed with status 404"));
  const result = await refundReturnRequestAction("return");
  expect(result.error).toContain("pode ser reprocessada");
  expect(result.error).not.toContain("unexpected");
});
