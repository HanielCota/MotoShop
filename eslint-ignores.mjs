/**
 * Paths that `pnpm lint` (eslint .) never walks. Kept out of `eslint.config.mjs` so a test can check
 * them without loading every lint plugin, which takes seconds.
 */
export const projectIgnores = [
  // Default ignores of eslint-config-next:
  // Every local Next.js dist dir (.next, .next-e2e, .next-build-check, ...).
  ".next*/**",
  "out/**",
  "build/**",
  "next-env.d.ts",
  "src/generated/**",
  "playwright-report/**",
  "playwright-report-demo/**",
  "test-results/**",
  "test-results-demo/**",
  // Local agent folders (worktrees with their own .next and src, notes, prints): not project code (A12).
  ".claude/**",
];
