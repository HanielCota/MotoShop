import { ESLint } from "eslint";
import { expect, it } from "vitest";

// A12: `pnpm lint` (eslint .) must not walk into .claude/, where the agent worktrees keep their own
// .next and src copies. Before, only the CI command skipped it with --ignore-pattern.
it("ignores the local agent folders and still lints the project code", async () => {
  const eslint = new ESLint({ cwd: process.cwd() });

  expect(await eslint.isPathIgnored(".claude/worktrees/example/src/app/page.tsx")).toBe(true);
  expect(await eslint.isPathIgnored(".claude/worktrees/example/.next/server/app.js")).toBe(true);
  expect(await eslint.isPathIgnored("src/app/page.tsx")).toBe(false);
}, 60_000);
