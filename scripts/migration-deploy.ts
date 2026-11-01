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
const EMPTY_DATABASE_CHECK = `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public') THEN RAISE EXCEPTION '${NOT_EMPTY_MARKER}'; END IF; END $$;`;

export type PrismaCommandResult = { readonly exitCode: number; readonly output: string };
export type RunPrisma = (args: readonly string[], input?: string) => Promise<PrismaCommandResult>;

export class MigrationDeployError extends Error {
  constructor(step: string, result: PrismaCommandResult) {
    super(`db:deploy: ${step} failed with exit code ${result.exitCode}.\n${result.output}`);
    this.name = "MigrationDeployError";
  }
}

/**
 * Reads the result of the empty-database check: success means no table exists in the public schema.
 *
 * @throws {MigrationDeployError} When the check failed for another reason (connection, permission).
 */
export function isEmptyDatabase(result: PrismaCommandResult): boolean {
  if (result.exitCode === 0) return true;
  if (result.output.includes(NOT_EMPTY_MARKER)) return false;

  throw new MigrationDeployError("the empty-database check", result);
}

async function runStep(runPrisma: RunPrisma, step: string, args: readonly string[]): Promise<void> {
  const result = await runPrisma(args);
  if (result.exitCode !== 0) throw new MigrationDeployError(step, result);

  console.log(result.output);
}

/**
 * Applies the versioned migrations, bootstrapping the foundation migration first on an empty database.
 *
 * @param runPrisma - Runs one Prisma CLI command and returns its exit code and output.
 * @throws {MigrationDeployError} When any Prisma command fails; later steps do not run.
 */
export async function deployMigrations(runPrisma: RunPrisma): Promise<void> {
  const check = await runPrisma(["db", "execute", "--stdin"], EMPTY_DATABASE_CHECK);

  if (isEmptyDatabase(check)) {
    console.log(`Empty database: applying ${FOUNDATION_MIGRATION} first.`);
    await runStep(runPrisma, `applying ${FOUNDATION_MIGRATION}`, [
      "db",
      "execute",
      "--file",
      `prisma/migrations/${FOUNDATION_MIGRATION}/migration.sql`,
    ]);
    await runStep(runPrisma, `recording ${FOUNDATION_MIGRATION}`, [
      "migrate",
      "resolve",
      "--applied",
      FOUNDATION_MIGRATION,
    ]);
  }

  await runStep(runPrisma, "migrate deploy", ["migrate", "deploy"]);
}
