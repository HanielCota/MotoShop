import { expect, it } from "vitest";

import { isSingleAccountModeActive, type SingleAccountModeSettings } from "./single-account-mode";

const TEST_HOST = "ep-teste-pagamento.sa-east-1.aws.neon.tech";
const PRODUCTION_DATABASE_URL = "postgresql://user:password@ep-production.sa-east-1.aws.neon.tech/neondb";

const testMode: SingleAccountModeSettings = {
  enabled: true,
  testDatabaseHost: TEST_HOST,
  databaseUrl: `postgresql://user:password@${TEST_HOST}/neondb?sslmode=require`,
  accessToken: "TEST-1234567890",
  publicKey: "TEST-00000000-0000-0000-0000-000000000000",
  deploymentEnvironment: undefined,
};

const productionMode: SingleAccountModeSettings = {
  enabled: true,
  testDatabaseHost: undefined,
  databaseUrl: PRODUCTION_DATABASE_URL,
  accessToken: "APP_USR-1234567890",
  publicKey: "APP_USR-00000000-0000-0000-0000-000000000000",
  deploymentEnvironment: "production",
};

it("stays off unless the switch is on, in test and in production", () => {
  expect(isSingleAccountModeActive({ ...testMode, enabled: undefined })).toBe(false);
  expect(isSingleAccountModeActive({ ...productionMode, enabled: undefined })).toBe(false);
  expect(isSingleAccountModeActive({ ...productionMode, enabled: false })).toBe(false);
});

it("turns on with production credentials in the Vercel production deployment", () => {
  expect(isSingleAccountModeActive(productionMode)).toBe(true);
  expect(isSingleAccountModeActive({ ...productionMode, publicKey: undefined })).toBe(true);
});

it("refuses a missing token and a Public Key from the other environment", () => {
  expect(isSingleAccountModeActive({ ...productionMode, accessToken: undefined })).toBe(false);
  expect(isSingleAccountModeActive({ ...productionMode, publicKey: testMode.publicKey })).toBe(false);
  expect(isSingleAccountModeActive({ ...testMode, publicKey: productionMode.publicKey })).toBe(false);
});

it("turns test credentials on only for the named test database, outside production", () => {
  expect(isSingleAccountModeActive(testMode)).toBe(true);
  expect(isSingleAccountModeActive({ ...testMode, deploymentEnvironment: "preview" })).toBe(true);
  expect(isSingleAccountModeActive({ ...testMode, publicKey: undefined })).toBe(true);
  expect(isSingleAccountModeActive({ ...testMode, testDatabaseHost: ` ${TEST_HOST.toUpperCase()} ` })).toBe(true);
});

it("keeps test credentials off without the test database variable", () => {
  expect(isSingleAccountModeActive({ ...testMode, testDatabaseHost: undefined })).toBe(false);
});

// Regression: a boolean flag left on with the .env.local database would mark test-card orders as paid in
// production; test credentials now only run against the database host the mode names.
it("keeps test credentials off when the server writes to any other database, such as production", () => {
  expect(isSingleAccountModeActive({ ...testMode, databaseUrl: PRODUCTION_DATABASE_URL })).toBe(false);
  expect(isSingleAccountModeActive({ ...testMode, databaseUrl: "not a url" })).toBe(false);
});

// Regression: Mercado Pago test users get APP_USR- credentials that accept test cards, so outside the
// Vercel production deployment the prefix alone must not let the mode charge into another database.
it("keeps APP_USR- credentials off outside Vercel production unless the server writes to the test database", () => {
  const appUserCredentials = { accessToken: productionMode.accessToken, publicKey: productionMode.publicKey };

  expect(isSingleAccountModeActive({ ...testMode, ...appUserCredentials, databaseUrl: PRODUCTION_DATABASE_URL })).toBe(
    false,
  );
  expect(isSingleAccountModeActive({ ...productionMode, deploymentEnvironment: "preview" })).toBe(false);
  expect(isSingleAccountModeActive({ ...testMode, ...appUserCredentials })).toBe(true);
});

it("refuses test credentials in the Vercel production deployment even with the test database", () => {
  expect(isSingleAccountModeActive({ ...testMode, deploymentEnvironment: "production" })).toBe(false);
});
