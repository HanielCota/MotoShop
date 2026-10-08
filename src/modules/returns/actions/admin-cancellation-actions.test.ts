import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ review: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireAdminAccess: async () => ({ user: { id: "admin" } }),
}));
vi.mock("../application/review-cancellation", () => ({ reviewCancellationRequest: mocks.review }));
import { ApplicationError } from "@/shared/errors/application-error";

import { reviewCancellationRequestAction } from "./admin-cancellation-actions";

function form(decision: string, note?: string) {
  const data = new FormData();
  data.set("decision", decision);
  if (note) data.set("note", note);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
});

it("delegates the decision to the application service and revalidates the order", async () => {
  mocks.review.mockResolvedValue({ outcome: "REJECTED", orderNumber: "MS-1" });
  expect(await reviewCancellationRequestAction("request", form("REJECT", "Já postado"))).toEqual({
    success: "Solicitação de cancelamento rejeitada.",
  });
  expect(mocks.review).toHaveBeenCalledWith({
    cancellationRequestId: "request",
    decision: "REJECT",
    note: "Já postado",
    actorUserId: "admin",
  });
  expect(mocks.revalidate).toHaveBeenCalledWith("/orders/MS-1");
});

it("maps application errors to a predictable action result", async () => {
  mocks.review.mockRejectedValue(
    new ApplicationError({ code: "CONFLICT", message: "Esta solicitação já foi decidida." }),
  );
  expect((await reviewCancellationRequestAction("request", form("APPROVE"))).error).toContain("já foi decidida");
});

it("rejects an invalid decision without calling the service", async () => {
  expect(await reviewCancellationRequestAction("request", form("MAYBE"))).toHaveProperty("error");
  expect(mocks.review).not.toHaveBeenCalled();
});

it("keeps an unexpected refund failure retryable instead of leaking a generic English error", async () => {
  mocks.review.mockRejectedValue(new Error("Mercado Pago request failed with status 404"));
  const result = await reviewCancellationRequestAction("request", form("APPROVE"));
  expect(result.error).toContain("pode ser reprocessada");
  expect(result.error).not.toContain("unexpected");
});
