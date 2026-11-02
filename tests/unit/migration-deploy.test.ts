import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deployMigrations,
  isEmptyDatabase,
  MigrationDeployError,
  type PrismaCommandResult,
  type RunPrisma,
} from "../../scripts/migration-deploy";

const ok: PrismaCommandResult = { exitCode: 0, output: "" };
const notEmpty: PrismaCommandResult = { exitCode: 1, output: "Error: ERROR: MOTOSHOP_DATABASE_NOT_EMPTY" };
const unreachable: PrismaCommandResult = { exitCode: 1, output: "Error: P1001: Can't reach database server" };

function fakePrisma(results: readonly PrismaCommandResult[]) {
  const runPrisma = vi.fn<RunPrisma>().mockResolvedValue(ok);
  for (const result of results) runPrisma.mockResolvedValueOnce(result);
  const commands = () => runPrisma.mock.calls.map(([args]) => args.join(" "));

  return { commands, runPrisma };
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
    const { commands, runPrisma } = fakePrisma([ok, ok, ok, ok]);

    await deployMigrations(runPrisma);

    expect(commands()).toEqual([
      "db execute --stdin",
      "db execute --file prisma/migrations/20260910144000_initial_foundation/migration.sql",
      "migrate resolve --applied 20260910144000_initial_foundation",
      "migrate deploy",
    ]);
  });

  it("only runs the usual deploy on a database that already has tables", async () => {
    const { commands, runPrisma } = fakePrisma([notEmpty, ok]);

    await deployMigrations(runPrisma);

    expect(commands()).toEqual(["db execute --stdin", "migrate deploy"]);
  });

  it("passes the extra arguments on to migrate deploy", async () => {
    const { commands, runPrisma } = fakePrisma([notEmpty, ok]);

    await deployMigrations(runPrisma, ["--schema", "other.prisma"]);

    expect(commands()).toEqual(["db execute --stdin", "migrate deploy --schema other.prisma"]);
  });

  it("does not deploy when the empty-database check cannot reach the database", async () => {
    const { commands, runPrisma } = fakePrisma([unreachable]);

    const deploy = deployMigrations(runPrisma);

    await expect(deploy).rejects.toThrow(/the empty-database check failed with exit code 1/);
    expect(commands()).toEqual(["db execute --stdin"]);
  });

  it("stops before recording the foundation migration when applying it fails", async () => {
    const { commands, runPrisma } = fakePrisma([ok, { exitCode: 1, output: "type already exists" }]);

    const deploy = deployMigrations(runPrisma);

    await expect(deploy).rejects.toThrow(/applying 20260910144000_initial_foundation failed/);
    expect(commands()).toHaveLength(2);
  });

  it("tells how to recover when recording the foundation migration fails after applying it", async () => {
    const { runPrisma } = fakePrisma([ok, ok, { exitCode: 1, output: "connection reset" }]);

    const deploy = deployMigrations(runPrisma);

    await expect(deploy).rejects.toThrow(/run `prisma migrate resolve --applied 20260910144000_initial_foundation`/);
  });

  it("runs the empty-database check quietly against the schema Prisma targets", async () => {
    const { runPrisma } = fakePrisma([notEmpty, ok]);

    await deployMigrations(runPrisma);

    const checkOptions = runPrisma.mock.calls[0]?.[1];
    expect(checkOptions?.quiet).toBe(true);
    expect(checkOptions?.input).toContain("schemaname = current_schema()");
  });
});
