// @vitest-environment node
import { readFileSync } from "node:fs";
import { relative } from "node:path";

import { expect, it } from "vitest";

import { listSourceFiles, sourceDirectory } from "../../../tests/support/source-files";

/** ShoppingBag is the cart (IC-04): orders and empty results use their own icons from domainIcons. */
it("keeps ShoppingBag for the cart only", () => {
  const cartFiles = ["cart", "checkout"];
  const offenders = listSourceFiles({ extensions: [".ts", ".tsx"] })
    .filter((file) => /\bShoppingBag\b/.test(readFileSync(file, "utf8")))
    .map((file) => relative(sourceDirectory, file))
    .filter((file) => !cartFiles.some((name) => file.includes(name)) && !file.includes("domain-icons"));

  expect(offenders).toEqual([]);
});
