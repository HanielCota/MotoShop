import { describe, expect, it } from "vitest";

import { parseAuthUserName } from "./auth-user-name";

describe("parseAuthUserName", () => {
  it("trims and accepts unicode names", () => {
    expect(parseAuthUserName("  José Ávila  ")).toEqual({ ok: true, name: "José Ávila" });
  });

  it.each(["", "   ", "a", "x".repeat(121), null, 42])("rejects %j", (input) => {
    expect(parseAuthUserName(input).ok).toBe(false);
  });
});
