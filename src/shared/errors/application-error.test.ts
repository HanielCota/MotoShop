import { describe, expect, it } from "vitest";

import { ApplicationError, asApplicationError } from "./application-error";

describe("asApplicationError", () => {
  it("preserves known application errors", () => {
    const error = new ApplicationError({ code: "NOT_FOUND", message: "Seller not found", statusCode: 404 });
    expect(asApplicationError(error)).toBe(error);
  });

  it("hides unexpected implementation details", () => {
    const error = asApplicationError(new Error("database password leaked"));
    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.message).toBe("An unexpected error occurred.");
  });
});
