// @vitest-environment node
import { join } from "node:path";

import { expect, it } from "vitest";

import { isWantedPath, parseGitFileList } from "../support/source-files";

// Regression: without -z, git quotes and escapes accented names ("src/promo\303\247\303\243o.ts"),
// so the scan would try to read a path that does not exist.
it("keeps accented file names from the NUL-separated git grep output", () => {
  const output = "src/app/page.tsx\0src/modules/promoção.ts\0";

  expect(parseGitFileList(output, "/repo")).toEqual([
    join("/repo", "src/app/page.tsx"),
    join("/repo", "src/modules/promoção.ts"),
  ]);
});

it("skips generated code inside src but not a checkout under a folder of that name", () => {
  const root = join("/home/generated/motoshop", "src");
  const options = { extensions: [".ts"] };

  expect(isWantedPath(join(root, "app", "page.ts"), options, root)).toBe(true);
  expect(isWantedPath(join(root, "generated", "prisma", "client.ts"), options, root)).toBe(false);
  expect(isWantedPath(join(root, "app", "page.test.ts"), options, root)).toBe(false);
});
