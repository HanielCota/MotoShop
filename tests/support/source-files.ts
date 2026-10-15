import { readdirSync } from "node:fs";
import { join } from "node:path";

export const sourceDirectory = join(process.cwd(), "src");

/** Generated code (Prisma client, ~5 MB) is not ours to lint and makes every scan slow. */
const SKIPPED_DIRECTORIES = new Set(["generated", "node_modules"]);

type SourceFileOptions = {
  /** File name suffixes to keep, e.g. [".tsx"] or [".ts", ".tsx"]. */
  extensions: readonly string[];
  /** Keep `*.test.*` files (default: false). */
  includeTests?: boolean;
};

/** Every source file under `directory`, skipping generated code, for convention tests that scan the code. */
export function listSourceFiles(options: SourceFileOptions, directory = sourceDirectory): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRECTORIES.has(entry.name) ? [] : listSourceFiles(options, path);
    if (!options.extensions.some((extension) => entry.name.endsWith(extension))) return [];
    if (!options.includeTests && entry.name.includes(".test.")) return [];
    return [path];
  });
}
