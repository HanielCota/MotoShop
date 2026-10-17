import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";

import config from "../../next.config";

it("does not advertise the framework in X-Powered-By (L-22)", () => {
  expect(config.poweredByHeader).toBe(false);
});

// A4: with a custom dist dir Next adds that dir's generated types to the tsconfig it uses and
// rewrites the file. The e2e build points to its own tsconfig, which already lists them, so the
// committed tsconfig.json never changes.
it("gives the e2e build its own tsconfig that already lists the e2e generated types (A4)", async () => {
  vi.stubEnv("NEXT_TEST_DIST_DIR", ".next-e2e");
  vi.resetModules();
  try {
    const { default: e2eConfig } = await import("../../next.config");
    expect(e2eConfig.distDir).toBe(".next-e2e");
    expect(e2eConfig.typescript?.tsconfigPath).toBe("tsconfig.e2e.json");

    const e2eTsconfig = JSON.parse(readFileSync(join(process.cwd(), "tsconfig.e2e.json"), "utf8")) as {
      extends: string;
      include: string[];
      exclude: string[];
    };
    expect(e2eTsconfig.extends).toBe("./tsconfig.json");
    expect(e2eTsconfig.include).toEqual(
      expect.arrayContaining([".next-e2e/types/**/*.ts", ".next-e2e/dev/types/**/*.ts"]),
    );
    expect(e2eTsconfig.exclude).not.toContain(".next-*");
  } finally {
    vi.unstubAllEnvs();
    vi.resetModules();
  }
});

it("keeps the regular build on the committed tsconfig.json", () => {
  expect(config.distDir).toBeUndefined();
  expect(config.typescript?.tsconfigPath).toBeUndefined();
});
