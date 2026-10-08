import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { expect, test as setup } from "@playwright/test";

import { demoAccounts, demoStorageState, type DemoRole } from "./demo-accounts";

// One sign-in per account (the auth rate limit is 10/min); both device projects reuse the session.
for (const [role, account] of Object.entries(demoAccounts()) as [
  DemoRole,
  { email: string; password: string } | null,
][]) {
  setup(`sign in as ${role}`, async ({ page }) => {
    const statePath = demoStorageState(role);
    mkdirSync(path.dirname(statePath), { recursive: true });
    if (!account) {
      writeFileSync(statePath, JSON.stringify({ cookies: [], origins: [] }));
      setup.skip(true, "DEMO_ADMIN_EMAIL / DEMO_ADMIN_PASSWORD not set");
      return;
    }
    await page.goto("/login");
    await page.getByLabel("E-mail", { exact: true }).fill(account.email);
    await page.getByLabel("Senha", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).not.toHaveURL(/\/login/);
    await page.context().storageState({ path: statePath });
  });
}
