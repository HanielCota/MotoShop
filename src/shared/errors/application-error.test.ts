import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ApplicationError, asApplicationError } from "./application-error";

describe("asApplicationError", () => {
  it("preserves known application errors", () => {
    const error = new ApplicationError({ code: "NOT_FOUND", message: "Seller not found", statusCode: 404 });
    expect(asApplicationError(error)).toBe(error);
  });

  it("hides unexpected implementation details behind a Portuguese message", () => {
    const error = asApplicationError(new Error("database password leaked"));
    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.message).toBe("Não foi possível concluir a operação. Tente novamente.");
  });

  it("maps a ZodError to a validation error with the schema's own message", () => {
    const result = z.object({ name: z.string().min(2, "Informe o nome.") }).safeParse({ name: "a" });
    const error = asApplicationError(result.error);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("Informe o nome.");
  });

  it("does not surface Zod's default English messages from tampered payloads", () => {
    const result = z.object({ quantity: z.number().int() }).safeParse({ quantity: "lots" });
    const error = asApplicationError(result.error);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("Confira os dados informados.");
  });
});
