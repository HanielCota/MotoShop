import { expect, it } from "vitest";

import { maskDateTyping } from "./date-mask";

it.each([
  ["1", "1"],
  ["17", "17"],
  ["171", "17/1"],
  ["171020", "17/10/20"],
  ["17102026", "17/10/2026"],
  ["1710202699", "17/10/2026"],
  ["17/", "17/"],
  ["17/10/2026", "17/10/2026"],
])("adds the slashes while typing: %s -> %s", (typed, masked) => {
  expect(maskDateTyping(typed)).toBe(masked);
});

it("completes a single-digit day or month with a zero when a separator is typed", () => {
  expect(maskDateTyping("1/")).toBe("01/");
  expect(maskDateTyping("1/2/2026")).toBe("01/02/2026");
  expect(maskDateTyping("1.2.2026")).toBe("01/02/2026");
});
