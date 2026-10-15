import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");

it("hides the native clear button of search fields (DN-02)", () => {
  expect(css).toMatch(/input\[type="search"\]::-webkit-search-cancel-button[\s\S]*?display: none/);
});

it("hides Edge's own password reveal button (DN-04)", () => {
  expect(css).toMatch(/input::-ms-reveal[\s\S]*?display: none/);
});

it("gives links and summaries the DS focus ring instead of the browser outline (DN-05)", () => {
  expect(css).toMatch(/a:focus-visible,\s*summary:focus-visible[\s\S]*?outline: none;[\s\S]*?box-shadow: 0 0 0 3px/);
});

it("keeps the autofill disguise under the focus ring, outside the layers (DN-06)", () => {
  const autofillFocus = css.indexOf("input:-webkit-autofill:focus-visible");
  const lastLayerEnd = css.lastIndexOf("@layer");

  expect(autofillFocus).toBeGreaterThan(lastLayerEnd);
  expect(css.slice(autofillFocus)).toMatch(/0 0 0 1000px var\(--background\) inset,\s*0 0 0 3px/);
});
