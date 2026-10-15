import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { expect, it } from "vitest";

const sourceDirectory = join(process.cwd(), "src");

function findSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findSources(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [path] : [];
  });
}

/** ShoppingBag is the cart (IC-04): orders and empty results use their own icons from domainIcons. */
it("keeps ShoppingBag for the cart only", () => {
  const cartFiles = ["cart", "checkout"];
  const offenders = findSources(sourceDirectory)
    .filter((file) => /\bShoppingBag\b/.test(readFileSync(file, "utf8")))
    .map((file) => relative(sourceDirectory, file))
    .filter((file) => !cartFiles.some((name) => file.includes(name)) && !file.includes("domain-icons"));

  expect(offenders).toEqual([]);
}, 30_000);
