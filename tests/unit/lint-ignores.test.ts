// @vitest-environment node
import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

const config = JSON.parse(readFileSync(".oxlintrc.json", "utf8")) as { ignorePatterns?: unknown };

// A12: `pnpm lint` must not walk into .claude/, where the agent worktrees keep their own .next and src
// copies, nor into generated code or build output. The config is read directly: the patterns are the
// contract, and running the linter here would be slow.
it("ignores the local agent folders, generated code and build output", () => {
  expect(config.ignorePatterns).toEqual(
    expect.arrayContaining([".claude/**", "src/generated/**", ".next*/**", "next-env.d.ts"]),
  );
});

it("does not ignore the project code", () => {
  const patterns = Array.isArray(config.ignorePatterns) ? config.ignorePatterns : [];
  expect(patterns.filter((pattern) => /^(src|tests|tools)(\/|\*)/.test(String(pattern)))).toEqual(["src/generated/**"]);
});
