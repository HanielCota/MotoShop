import { describe, expect, it } from "vitest";

import { getSafeRedirectPath } from "./safe-redirect";

describe("getSafeRedirectPath", () => {
  it.each([
    ["/orders?x=1", "/orders?x=1"],
    ["/products/capacete#avaliacoes", "/products/capacete#avaliacoes"],
    ["/", "/"],
  ])("keeps internal path %s", (input, expected) => {
    expect(getSafeRedirectPath(input)).toBe(expected);
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "/%09/evil.com",
    "/%2F/evil.com",
    "/\t/evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "evil.com",
    "",
    null,
    undefined,
    "/%E0%A4%A",
  ])("rejects %s", (input) => {
    expect(getSafeRedirectPath(input)).toBe("/");
  });
});
