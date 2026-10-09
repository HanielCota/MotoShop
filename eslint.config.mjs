import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Regras de estilo do projeto (AGENTS.md, "Padrões de código").
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "IfStatement[alternate]",
          message: "Não use else: retorne cedo (early return), use continue em laços ou extraia uma função.",
        },
        {
          selector: "CallExpression[callee.property.name='then']",
          message: "Use async/await em vez de .then().",
        },
      ],
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
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
