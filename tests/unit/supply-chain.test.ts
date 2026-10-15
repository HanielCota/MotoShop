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

it("never leaves the GitHub token in the checked-out repository", () => {
  const workflows = ["ci.yml", "e2e.yml", "codeql.yml", "pull-request.yml"].map((name) =>
    readRepositoryFile(join(".github", "workflows", name)),
  );

  for (const workflow of workflows) {
    const checkouts = workflow.match(/uses: actions\/checkout@.*\n\s+with:\n\s+persist-credentials: false/g) ?? [];
    const allCheckouts = workflow.match(/uses: actions\/checkout@/g) ?? [];
    expect(checkouts).toHaveLength(allCheckouts.length);
  }
});
