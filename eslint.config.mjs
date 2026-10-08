import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
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
  ]),
]);

export default eslintConfig;
