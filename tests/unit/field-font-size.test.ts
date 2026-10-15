import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { expect, it } from "vitest";

const sourceDirectory = join(process.cwd(), "src");

function findComponents(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findComponents(path);
    return entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx") ? [path] : [];
  });
}

/** Opening JSX tags of the field primitives, up to the end of their attributes. */
const FIELD_TAG = /<(Input|Textarea|DesignSelect)\b[\s\S]*?(\/>|>\n)/g;
const SMALL_FONT = /className=(?:"|\{`)[^"`]*\btext-(xs|sm)\b/;

/**
 * Fields keep 16px on phones (`text-base`) so iOS does not zoom in on focus; the primitives already
 * switch to 14px from `sm` up. A `text-sm`/`text-xs` override brings the zoom back.
 */
it("never shrinks the font of Input, Textarea or DesignSelect below 16px on phones", () => {
  const offenders = findComponents(sourceDirectory).flatMap((file) => {
    const source = readFileSync(file, "utf8");
    if (file.includes(join("components", "ui"))) return [];

    return [...source.matchAll(FIELD_TAG)]
      .filter((match) => SMALL_FONT.test(match[0]) && !match[0].includes("readOnly"))
      .map((match) => `${relative(sourceDirectory, file)}: <${match[1]}>`);
  });

  expect(offenders).toEqual([]);
});
