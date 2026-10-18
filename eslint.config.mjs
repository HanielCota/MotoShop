import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

import { projectIgnores } from "./eslint-ignores.mjs";

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
      "max-depth": ["error", 3],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([...projectIgnores]),
]);

export default eslintConfig;
