import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, it } from "vitest";

function readRepositoryFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

it("pins every remote CLI run by a package script to an exact version", () => {
  const packageJson = JSON.parse(readRepositoryFile("package.json")) as { scripts: Record<string, string> };
  const remoteRuns = Object.values(packageJson.scripts).filter((script) => /\b(dlx|npx)\b/.test(script));

  for (const script of remoteRuns) {
    expect(script).toMatch(/@\d+\.\d+\.\d+\b/);
    expect(script).not.toMatch(/@(latest|next)\b/);
  }
});

it("declares the minimum release age next to its exceptions", () => {
  expect(readRepositoryFile("pnpm-workspace.yaml")).toMatch(/^minimumReleaseAge: \d+$/m);
});
