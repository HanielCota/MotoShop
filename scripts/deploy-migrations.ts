/** `pnpm db:deploy`: applies the versioned migrations, also on an empty database (see migration-deploy.ts). */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { deployMigrations, type PrismaCommandResult } from "./migration-deploy";

const prismaCli = join(dirname(createRequire(import.meta.url).resolve("prisma/package.json")), "build", "index.js");

function runPrismaCli(args: readonly string[], input?: string): Promise<PrismaCommandResult> {
  const { promise, resolve, reject } = Promise.withResolvers<PrismaCommandResult>();
  const child = spawn(process.execPath, [prismaCli, ...args], { stdio: ["pipe", "pipe", "pipe"] });
  const chunks: string[] = [];

  child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
  child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
  child.on("error", reject);
  child.on("close", (code) => resolve({ exitCode: code ?? 1, output: chunks.join("") }));
  child.stdin.end(input ?? "");

  return promise;
}

await deployMigrations(runPrismaCli);
