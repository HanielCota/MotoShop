import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join, sep } from "node:path";

export const sourceDirectory = join(process.cwd(), "src");

/** Generated code (Prisma client, ~5 MB) is not ours to lint and makes every scan slow. */
const SKIPPED_DIRECTORIES = new Set(["generated", "node_modules"]);

const GIT_GREP_TIMEOUT_MS = 10_000;

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
    return isWantedFile(entry.name, options) ? [path] : [];
  });
}

/**
 * The source files whose text matches `pattern`, for convention tests that look for one word. `git grep`
 * finds them natively in a fraction of a second, so the test only reads those few files instead of
 * the whole project, which timed out on a busy machine. Without git, it falls back to a full scan.
 * `pattern` must be valid both as a JavaScript regex and as a POSIX extended regex (no lookarounds).
 */
export function listSourceFilesMatching(pattern: string, options: SourceFileOptions): string[] {
  const matching = gitGrepSourceFiles(pattern);
  if (matching != null) return matching.filter((path) => isWantedPath(path, options));

  const regex = new RegExp(pattern);
  return listSourceFiles(options).filter((path) => regex.test(readFileSync(path, "utf8")));
}

/** Tracked and untracked (not ignored) files under src/ that match, or `null` when git cannot answer. */
function gitGrepSourceFiles(pattern: string): string[] | null {
  try {
    const output = execFileSync("git", ["grep", "-l", "--untracked", "-E", pattern, "--", "src"], {
      cwd: process.cwd(),
      encoding: "utf8",
      // A stuck git must not hang the test run; the timeout error falls back to the full scan.
      timeout: GIT_GREP_TIMEOUT_MS,
    });
    return output
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => join(process.cwd(), line));
  } catch (error) {
    // Exit status 1 means "no file matches"; anything else (no git, not a repository) falls back.
    return isNoMatch(error) ? [] : null;
  }
}

function isNoMatch(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && error.status === 1;
}

function isWantedPath(path: string, options: SourceFileOptions): boolean {
  const directories = path.split(sep);
  if (directories.some((directory) => SKIPPED_DIRECTORIES.has(directory))) return false;

  return isWantedFile(basename(path), options);
}

function isWantedFile(name: string, options: SourceFileOptions): boolean {
  if (!options.extensions.some((extension) => name.endsWith(extension))) return false;

  return options.includeTests === true || !name.includes(".test.");
}
