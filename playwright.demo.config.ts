import { defineConfig, devices } from "@playwright/test";

/**
 * Read-only walkthrough of the review demo (`pnpm db:seed:review`) against an already running server.
 * It only signs in and navigates — it never creates, edits or deletes data — so it is safe against the
 * database that hosts the demo. The full E2E suite (playwright.config.ts) writes data and needs an
 * isolated TEST_DATABASE_URL instead.
 *
 *   pnpm dev:review                     # server on http://localhost:3001
 *   pnpm test:demo                      # storefront, customer and seller center
 *   DEMO_ADMIN_EMAIL=... DEMO_ADMIN_PASSWORD=... pnpm test:demo   # also the Admin (account in ADMIN_EMAILS)
 */
export default defineConfig({
  testDir: "./tests/demo",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-demo" }]],
  outputDir: "test-results-demo",
  use: {
    baseURL: process.env.DEMO_BASE_URL ?? "http://localhost:3001",
    actionTimeout: 20_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
    { name: "mobile", use: { ...devices["Pixel 7"] }, dependencies: ["setup"] },
  ],
});
