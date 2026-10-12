import path from "node:path";

import { requireEnv } from "../support/must";

export type DemoRole = "customer" | "seller" | "catalog" | "admin";

export const demoStorageState = (role: DemoRole) => path.resolve(`test-results-demo/.auth/${role}.json`);

export function demoAccounts(): Record<DemoRole, { email: string; password: string } | null> {
  // The same shared password the review seed writes to every review.* account.
  const password = requireEnv("REVIEW_ACCOUNTS_PASSWORD");
  const adminEmail = process.env.DEMO_ADMIN_EMAIL;
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD;
  return {
    customer: { email: "review.cliente@example.test", password },
    seller: { email: "review.lojista@example.test", password },
    catalog: { email: "review.catalogo@example.test", password },
    // The Admin needs an e-mail listed in ADMIN_EMAILS; credentials only come from the environment.
    admin: adminEmail && adminPassword ? { email: adminEmail, password: adminPassword } : null,
  };
}
