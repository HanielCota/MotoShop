import { getConfig } from "@testing-library/react";
import { expect, it } from "vitest";

// Regression: with the 1 s default, the checkout test "masks the CEP, quotes automatically…" failed on
// a busy machine ("Unable to find an element with the text: Pista Norte") although the form was right.
it("gives findBy* and waitFor enough time on a busy machine, within the test timeout", () => {
  expect(getConfig().asyncUtilTimeout).toBe(5_000);
});
