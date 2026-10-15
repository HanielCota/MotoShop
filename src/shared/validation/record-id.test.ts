import { describe, expect, it } from "vitest";

import { ApplicationError } from "@/shared/errors/application-error";

import { assertRecordId, isRecordId } from "./record-id";

describe("record id validation", () => {
  it("accepts cuid ids", () => {
    expect(isRecordId("czrvw0seller0000000000001")).toBe(true);
    expect(() => assertRecordId("cm9x8y7z6a5b4c3d2e1f0g9h8", "Loja inválida.")).not.toThrow();
  });

  it.each([undefined, null, 42, "", "not a cuid!", "../../etc", { id: "x" }])("rejects %p", (value) => {
    expect(isRecordId(value)).toBe(false);
    expect(() => assertRecordId(value, "Loja inválida.")).toThrow(
      expect.objectContaining({ code: "VALIDATION_ERROR", message: "Loja inválida.", statusCode: 400 }),
    );
    expect(() => assertRecordId(value, "Loja inválida.")).toThrow(ApplicationError);
  });
});
