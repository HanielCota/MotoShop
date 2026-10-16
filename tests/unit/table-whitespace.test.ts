import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src");

function listTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "generated" ? [] : listTsxFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

// O React recusa texto, até um espaço, como filho de <tbody>/<tr> (erro de hidratação no /admin/orders).
const whitespaceInTable = /<(AdminTable|DataTable|tbody|tr)\b[^>]*>\s*\{" "\}/;

it("never renders a whitespace text node as a direct child of a table body or row", () => {
  const offenders = listTsxFiles(sourceRoot)
    .filter((file) => whitespaceInTable.test(readFileSync(file, "utf8")))
    .map((file) => relative(process.cwd(), file));

  expect(offenders).toEqual([]);
});
