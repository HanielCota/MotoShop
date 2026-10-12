import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({ logError: vi.fn() }));

vi.mock("@/lib/logger", () => ({ logger: { error: mocks.logError } }));

import { toActionError } from "./action-error";
import { ApplicationError, GENERIC_ERROR_MESSAGE } from "./application-error";

describe("toActionError", () => {
  beforeEach(() => mocks.logError.mockReset());

  it("logs unexpected errors and returns the generic message", () => {
    const result = toActionError(new Error("connection reset"), "cart.add");

    expect(result.code).toBe("INTERNAL_ERROR");
    expect(result.message).toBe(GENERIC_ERROR_MESSAGE);
    expect(mocks.logError).toHaveBeenCalledWith({
      event: "action.failed",
      action: "cart.add",
      error: { name: "Error", message: "connection reset" },
    });
  });

  it("passes domain and validation errors through without logging", () => {
    const domainError = new ApplicationError({ code: "OUT_OF_STOCK", message: "Sem estoque.", statusCode: 409 });

    expect(toActionError(domainError, "cart.add")).toBe(domainError);
    expect(toActionError(z.string().safeParse(1).error, "cart.add").code).toBe("VALIDATION_ERROR");
    expect(mocks.logError).not.toHaveBeenCalled();
  });
});
