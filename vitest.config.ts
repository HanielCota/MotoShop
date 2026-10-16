import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(projectRoot, "src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // jsdom component tests pay a cold-start cost on their first render in each file (accessibility
    // queries, computed styles, Base UI). Under parallel CI workers that first test can pass the
    // default 5s while doing no waiting at all, so the limit is 15s. Real hangs still fail.
    testTimeout: 15_000,
    hookTimeout: 15_000,
    include: ["src/**/*.test.{ts,tsx}", "tests/unit/**/*.test.ts"],
    coverage: { reporter: ["text", "html"] },
  },
});
