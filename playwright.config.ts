import { defineConfig, devices } from "@playwright/test";
import { randomUUID } from "node:crypto";

process.env.E2E_ADMIN_EMAIL ??= `e2e-admin-${randomUUID()}@example.test`;

const playwrightPort = process.env.PLAYWRIGHT_PORT ?? "3210";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${playwrightPort}`,
    actionTimeout: 20_000,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  ...(process.env.PLAYWRIGHT_BASE_URL
    ? {}
    : {
        webServer: {
          command: `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${playwrightPort}`,
          env: {
            ADMIN_EMAILS: process.env.E2E_ADMIN_EMAIL,
            BETTER_AUTH_URL: `http://127.0.0.1:${playwrightPort}`,
            NEXT_TEST_DIST_DIR: ".next-e2e",
            MERCADO_PAGO_ACCESS_TOKEN: "",
            MERCADO_PAGO_PUBLIC_KEY: "TEST-00000000-0000-4000-8000-000000000001",
            MERCADO_PAGO_NOTIFICATION_URL: "",
            MERCADO_PAGO_WEBHOOK_SECRET: "",
            MELHOR_ENVIO_TOKEN: "",
            RESEND_API_KEY: "",
            EMAIL_FROM: "",
          },
          timeout: 120_000,
          url: `http://127.0.0.1:${playwrightPort}`,
          reuseExistingServer: false,
        },
      }),
});
