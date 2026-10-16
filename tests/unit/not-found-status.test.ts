// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { expect, it } from "vitest";

const appDirectory = join(process.cwd(), "src", "app");

function findPages(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findPages(path);
    return entry.name === "page.tsx" ? [path] : [];
  });
}

function loadingBoundariesAbove(page: string): string[] {
  const boundaries: string[] = [];
  for (let directory = dirname(page); directory.startsWith(appDirectory); directory = dirname(directory)) {
    if (existsSync(join(directory, "loading.tsx"))) boundaries.push(relative(appDirectory, directory) || ".");
    if (directory === appDirectory) break;
  }
  return boundaries;
}

/**
 * A loading.tsx starts streaming before the page runs, which fixes the status at 200; a notFound()
 * after that renders "não encontrado" with HTTP 200 (soft 404). Pages that can be missing must not
 * sit under a loading.tsx: they check first and stream behind their own <Suspense>.
 */
it("keeps every page that calls notFound() outside loading.tsx boundaries", () => {
  const offenders = findPages(appDirectory)
    .filter((page) => readFileSync(page, "utf8").includes("notFound()"))
    .map((page) => ({ page: relative(appDirectory, page), boundaries: loadingBoundariesAbove(page) }))
    .filter(({ boundaries }) => boundaries.length > 0);

  expect(offenders).toEqual([]);
});
