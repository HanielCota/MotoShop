/**
 * `prisma migrate deploy` that also works on an empty database.
 *
 * The first migration folder (20260910121500_commercial_core) uses tables that the second one
 * (20260910144000_initial_foundation) creates, so a plain deploy on an empty database stops at the
 * first step. Applied folder names and contents cannot change, because Prisma checks them against the
 * databases that already have them. So on an empty database this applies the foundation migration
 * first and records it as applied; Prisma then applies the remaining ones in the usual order. On a
 * database that already has tables it only runs the usual deploy.
 */
const FOUNDATION_MIGRATION = "20260910144000_initial_foundation";
const NOT_EMPTY_MARKER = "MOTOSHOP_DATABASE_NOT_EMPTY";
// Any user table in any schema counts: `prisma db execute` does not pin search_path, so current_schema()
// can be an empty schema named after the role while the real tables live in `public`. Wrongly saying
// "not empty" only falls back to the plain deploy; wrongly saying "empty" would write to a live database.
const EMPTY_DATABASE_CHECK = `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')) THEN RAISE EXCEPTION '${NOT_EMPTY_MARKER}'; END IF; END $$;`;
const RECORDING_HINT = ` Its tables already exist: run \`prisma migrate resolve --applied ${FOUNDATION_MIGRATION}\` before retrying, or the deploy will fail on it.`;

/** Exit code and combined stdout/stderr of one Prisma CLI command. */
export type PrismaCommandResult = { readonly exitCode: number; readonly output: string };
/** Text for stdin, and whether to keep the command's output off the console (it is still returned). */
export type RunPrismaOptions = { readonly input?: string; readonly quiet?: boolean };
/** Runs one Prisma CLI command. */
export type RunPrisma = (args: readonly string[], options?: RunPrismaOptions) => Promise<PrismaCommandResult>;

/** A Prisma command of the deploy failed; the message names the step and carries its output. */
export class MigrationDeployError extends Error {
  constructor(step: string, result: PrismaCommandResult, hint = "") {
    super(`db:deploy: ${step} failed with exit code ${result.exitCode}.${hint}\n${result.output}`);
    this.name = "MigrationDeployError";
  }
}

/**
 * Reads the result of the empty-database check: success means no user table exists in any schema.
 *
 * @param result - Result of running the check through `prisma db execute`.
 * @returns Whether the database has no tables yet.
 * @throws {MigrationDeployError} When the check failed for another reason (connection, permission).
 */
export function isEmptyDatabase(result: PrismaCommandResult): boolean {
  if (result.exitCode === 0) return true;
  if (result.output.includes(NOT_EMPTY_MARKER)) return false;

  throw new MigrationDeployError("the empty-database check", result);
}

async function runStep(runPrisma: RunPrisma, step: string, args: readonly string[], hint = ""): Promise<void> {
  const result = await runPrisma(args);
  if (result.exitCode !== 0) throw new MigrationDeployError(step, result, hint);
}

/**
 * Applies the versioned migrations, bootstrapping the foundation migration first on an empty database.
 *
 * @param runPrisma - Runs one Prisma CLI command and returns its exit code and output.
 * @param deployArgs - Extra arguments for `prisma migrate deploy`, as given to `pnpm db:deploy`.
 * @throws {MigrationDeployError} When any Prisma command fails; later steps do not run.
 */
export async function deployMigrations(runPrisma: RunPrisma, deployArgs: readonly string[] = []): Promise<void> {
  // Quiet: on a database with tables the check fails on purpose, and its error would look like a real one.
  const check = await runPrisma(["db", "execute", "--stdin"], { input: EMPTY_DATABASE_CHECK, quiet: true });

  if (isEmptyDatabase(check)) {
    console.log(`Empty database: applying ${FOUNDATION_MIGRATION} first.`);
    await runStep(runPrisma, `applying ${FOUNDATION_MIGRATION}`, [
      "db",
      "execute",
      "--file",
      `prisma/migrations/${FOUNDATION_MIGRATION}/migration.sql`,
    ]);
    await runStep(
      runPrisma,
      `recording ${FOUNDATION_MIGRATION}`,
      ["migrate", "resolve", "--applied", FOUNDATION_MIGRATION],
      RECORDING_HINT,
    );
  }

  await runStep(runPrisma, "migrate deploy", ["migrate", "deploy", ...deployArgs]);
}
