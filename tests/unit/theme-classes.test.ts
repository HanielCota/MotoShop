// @vitest-environment node
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { expect, it } from "vitest";

import { listSourceFilesMatching, sourceDirectory } from "../support/source-files";

const css = readFileSync(join(sourceDirectory, "app", "globals.css"), "utf8");

/** Color utilities like `text-moto-brand-strong` only exist when the theme defines `--color-moto-brand-strong`. */
it("only uses brand color utilities that the theme defines", () => {
  const defined = new Set([...css.matchAll(/--color-([\w-]+):/g)].map((match) => match[1]));
  // Only the files that mention a brand utility are read; the precise check below runs on them.
  const candidates = listSourceFilesMatching("(text|bg|border|ring|fill|stroke)-(moto-)?brand", {
    extensions: [".ts", ".tsx"],
    includeTests: true,
  });
  const offenders = candidates.flatMap((file) =>
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
