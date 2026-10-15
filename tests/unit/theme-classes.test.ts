import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { expect, it } from "vitest";

const sourceDirectory = join(process.cwd(), "src");
const css = readFileSync(join(sourceDirectory, "app", "globals.css"), "utf8");

function findSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findSources(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** Color utilities like `text-moto-brand-strong` only exist when the theme defines `--color-moto-brand-strong`. */
it("only uses brand color utilities that the theme defines", () => {
  const defined = new Set([...css.matchAll(/--color-([\w-]+):/g)].map((match) => match[1]));
  const offenders = findSources(sourceDirectory).flatMap((file) =>
    [
      ...readFileSync(file, "utf8").matchAll(
        /(?<![\w-])(?:text|bg|border|ring|fill|stroke)-((?:moto-)?brand(?:-[a-z]+)*)(?![\w-])/g,
      ),
    ]
      .map((match) => match[1])
      .filter((color): color is string => typeof color === "string" && !defined.has(color))
      .map((color) => `${relative(sourceDirectory, file)}: ${color}`),
  );

  expect(offenders).toEqual([]);
});
