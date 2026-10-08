import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The shared password lives in the seed script; it is read as text because importing that module
 * would run the seed.
 */
function readReviewPassword(): string {
  const source = readFileSync(path.resolve("scripts/seed-review-data.ts"), "utf8");
  const match = source.match(/export const REVIEW_ACCOUNTS_PASSWORD = "([^"]+)"/);
  if (!match?.[1]) throw new Error("REVIEW_ACCOUNTS_PASSWORD not found in scripts/seed-review-data.ts");
  return match[1];
}

export type DemoRole = "customer" | "seller" | "catalog" | "admin";

export const demoStorageState = (role: DemoRole) => path.resolve(`test-results-demo/.auth/${role}.json`);

export function demoAccounts(): Record<DemoRole, { email: string; password: string } | null> {
  const password = readReviewPassword();
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
