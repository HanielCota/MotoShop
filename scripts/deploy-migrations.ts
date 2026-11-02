/** `pnpm db:deploy`: applies the versioned migrations, also on an empty database (see migration-deploy.ts). */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { deployMigrations, type PrismaCommandResult, type RunPrismaOptions } from "./migration-deploy";

const require = createRequire(import.meta.url);
const prismaPackagePath = require.resolve("prisma/package.json");
const prismaCli = join(dirname(prismaPackagePath), readPrismaBin(require(prismaPackagePath)));

function readPrismaBin(packageJson: unknown): string {
  if (typeof packageJson !== "object" || packageJson === null || "bin" in packageJson === false) {
    throw new Error("db:deploy: prisma/package.json has no bin entry.");
  }

  const bin = packageJson.bin;
  if (typeof bin === "object" && bin !== null && "prisma" in bin && typeof bin.prisma === "string") return bin.prisma;

  throw new Error("db:deploy: prisma/package.json has no bin.prisma entry.");
}

function runPrismaCli(args: readonly string[], options: RunPrismaOptions = {}): Promise<PrismaCommandResult> {
  const { promise, resolve, reject } = Promise.withResolvers<PrismaCommandResult>();
  const child = spawn(process.execPath, [prismaCli, ...args], { stdio: ["pipe", "pipe", "pipe"] });
  const chunks: string[] = [];
  const collectInto = (stream: NodeJS.WriteStream) => (chunk: Buffer) => {
    chunks.push(chunk.toString());
    if (options.quiet !== true) stream.write(chunk);
  };

  child.stdout.on("data", collectInto(process.stdout));
  child.stderr.on("data", collectInto(process.stderr));
  child.on("error", reject);
  child.on("close", (code) => resolve({ exitCode: code ?? 1, output: chunks.join("") }));
  child.stdin.end(options.input ?? "");

  return promise;
}

// pnpm may pass the "--" separator through; Prisma would reject it as an argument.
await deployMigrations(
  runPrismaCli,
  process.argv.slice(2).filter((arg) => arg !== "--"),
);
