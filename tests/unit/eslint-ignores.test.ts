// @vitest-environment node
import { readFileSync } from "node:fs";

import { ESLint } from "eslint";
import { globalIgnores } from "eslint/config";
import { expect, it } from "vitest";

import { projectIgnores } from "../../eslint-ignores.mjs";

// A12: `pnpm lint` (eslint .) must not walk into .claude/, where the agent worktrees keep their own
// .next and src copies. Before, only the CI command skipped it with --ignore-pattern.
// Only the ignore list is loaded: the full config pulls in every plugin and takes seconds.
it("ignores the local agent folders and still lints the project code", async () => {
  const eslint = new ESLint({
    cwd: process.cwd(),
    overrideConfigFile: true,
    // ESLint treats a file that no config block covers as ignored, so one empty block stands in for
    // the TypeScript and JavaScript files the real config lints.
    overrideConfig: [globalIgnores([...projectIgnores]), { files: ["**/*.{js,mjs,ts,tsx}"] }],
  });

  expect(await eslint.isPathIgnored(".claude/worktrees/example/src/app/page.tsx")).toBe(true);
  expect(await eslint.isPathIgnored(".claude/worktrees/example/.next/server/app.js")).toBe(true);
  expect(await eslint.isPathIgnored("src/app/page.tsx")).toBe(false);
});

it("is the ignore list that the lint config uses", () => {
  expect(readFileSync("eslint.config.mjs", "utf8")).toContain("globalIgnores([...projectIgnores])");
});
