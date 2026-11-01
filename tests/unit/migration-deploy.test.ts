import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deployMigrations,
  isEmptyDatabase,
  MigrationDeployError,
  type PrismaCommandResult,
} from "../../scripts/migration-deploy";

const ok: PrismaCommandResult = { exitCode: 0, output: "" };
const notEmpty: PrismaCommandResult = { exitCode: 1, output: "Error: ERROR: MOTOSHOP_DATABASE_NOT_EMPTY" };
const unreachable: PrismaCommandResult = { exitCode: 1, output: "Error: P1001: Can't reach database server" };

function fakePrisma(results: readonly PrismaCommandResult[]) {
  const calls: string[] = [];
  const runPrisma = vi.fn(async (args: readonly string[]) => {
    calls.push(args.join(" "));
    return results[calls.length - 1] ?? ok;
  });

  return { calls, runPrisma };
}

describe("isEmptyDatabase", () => {
  it("returns true when the check succeeds", () => {
    expect(isEmptyDatabase(ok)).toBe(true);
  });

  it("returns false when the check raises the not-empty marker", () => {
    expect(isEmptyDatabase(notEmpty)).toBe(false);
  });

  it("throws MigrationDeployError when the check fails for another reason", () => {
    expect(() => isEmptyDatabase(unreachable)).toThrow(MigrationDeployError);
  });
});

describe("deployMigrations", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applies and records the foundation migration before deploying on an empty database", async () => {
    const { calls, runPrisma } = fakePrisma([ok, ok, ok, ok]);

    await deployMigrations(runPrisma);

    expect(calls).toEqual([
      "db execute --stdin",
      "db execute --file prisma/migrations/20260910144000_initial_foundation/migration.sql",
      "migrate resolve --applied 20260910144000_initial_foundation",
      "migrate deploy",
    ]);
  });

  it("only runs the usual deploy on a database that already has tables", async () => {
    const { calls, runPrisma } = fakePrisma([notEmpty, ok]);

    await deployMigrations(runPrisma);

    expect(calls).toEqual(["db execute --stdin", "migrate deploy"]);
  });

  it("does not deploy when the empty-database check cannot reach the database", async () => {
    const { calls, runPrisma } = fakePrisma([unreachable]);

    const deploy = deployMigrations(runPrisma);

    await expect(deploy).rejects.toThrow(/the empty-database check failed with exit code 1/);
    expect(calls).toEqual(["db execute --stdin"]);
  });

  it("stops before recording the foundation migration when applying it fails", async () => {
    const { calls, runPrisma } = fakePrisma([ok, { exitCode: 1, output: "type already exists" }]);

    const deploy = deployMigrations(runPrisma);

    await expect(deploy).rejects.toThrow(/applying 20260910144000_initial_foundation failed/);
    expect(calls).toHaveLength(2);
  });
});
