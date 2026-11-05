import { expect, it } from "vitest";

import { isSingleAccountModeActive, type SingleAccountModeSettings } from "./single-account-mode";

const TEST_HOST = "ep-teste-pagamento.sa-east-1.aws.neon.tech";
const PRODUCTION_DATABASE_URL = "postgresql://user:password@ep-production.sa-east-1.aws.neon.tech/neondb";

const testMode: SingleAccountModeSettings = {
  enabled: "true",
  testDatabaseHost: TEST_HOST,
  databaseUrl: `postgresql://user:password@${TEST_HOST}/neondb?sslmode=require`,
  accessToken: "TEST-1234567890",
  publicKey: "TEST-00000000-0000-0000-0000-000000000000",
  deploymentEnvironment: undefined,
};

const productionMode: SingleAccountModeSettings = {
  enabled: "true",
  testDatabaseHost: undefined,
  databaseUrl: PRODUCTION_DATABASE_URL,
  accessToken: "APP_USR-1234567890",
  publicKey: "APP_USR-00000000-0000-0000-0000-000000000000",
  deploymentEnvironment: "production",
};

const appUserCredentials = { accessToken: productionMode.accessToken, publicKey: productionMode.publicKey };

it("stays off in production when the switch is missing", () => {
  const settings = { ...productionMode, enabled: undefined };

  const active = isSingleAccountModeActive(settings);

  expect(active).toBe(false);
});

it("stays off in production when the switch is false", () => {
  const settings = { ...productionMode, enabled: "false" };

  const active = isSingleAccountModeActive(settings);

  expect(active).toBe(false);
});

it("stays off on the test database when the switch is missing", () => {
  const settings = { ...testMode, enabled: undefined };

  const active = isSingleAccountModeActive(settings);

  expect(active).toBe(false);
});

// Regression: a switch typed as "TRUE" used to fail the whole environment and take the site down.
it("turns on with the switch typed in capitals and with spaces", () => {
  const settings = { ...productionMode, enabled: " TRUE " };

  const active = isSingleAccountModeActive(settings);

  expect(active).toBe(true);
});

it("stays off without failing when the switch has any other value", () => {
  const settings = { ...productionMode, enabled: "1" };

  const active = isSingleAccountModeActive(settings);

  expect(active).toBe(false);
});

it("turns on with production credentials in the Vercel production deployment", () => {
  const active = isSingleAccountModeActive(productionMode);

  expect(active).toBe(true);
});

it("turns on in production without a Public Key, for Pix only", () => {
  const settings = { ...productionMode, publicKey: undefined };

  const active = isSingleAccountModeActive(settings);

  expect(active).toBe(true);
});

it("refuses a missing Access Token", () => {
  const settings = { ...productionMode, accessToken: undefined };

  const active = isSingleAccountModeActive(settings);

  expect(active).toBe(false);
});

it("refuses a test Public Key with production credentials", () => {
  const settings = { ...productionMode, publicKey: testMode.publicKey };

  const active = isSingleAccountModeActive(settings);

  expect(active).toBe(false);
});

it("refuses a production Public Key with test credentials", () => {
  const settings = { ...testMode, publicKey: productionMode.publicKey };

  const active = isSingleAccountModeActive(settings);

  expect(active).toBe(false);
});

it("turns test credentials on for the named test database", () => {
  const active = isSingleAccountModeActive(testMode);

  expect(active).toBe(true);
});

it("turns test credentials on for the named test database in a preview deployment", () => {
  const settings = { ...testMode, deploymentEnvironment: "preview" };

  const active = isSingleAccountModeActive(settings);

  expect(active).toBe(true);
});

it("turns test credentials on for the test database without a Public Key", () => {
  const settings = { ...testMode, publicKey: undefined };

  const active = isSingleAccountModeActive(settings);

  expect(active).toBe(true);
});

it("matches the test database host regardless of case and spaces", () => {
  const settings = { ...testMode, testDatabaseHost: ` ${TEST_HOST.toUpperCase()} ` };

  const active = isSingleAccountModeActive(settings);

  expect(active).toBe(true);
});

it("keeps test credentials off without the test database variable", () => {
  const settings = { ...testMode, testDatabaseHost: undefined };

  const active = isSingleAccountModeActive(settings);

  expect(active).toBe(false);
});

// Regression: a boolean flag left on with the .env.local database would mark test-card orders as paid in
// production; test credentials now only run against the database host the mode names.
it("keeps test credentials off when the server writes to the production database", () => {
  const settings = { ...testMode, databaseUrl: PRODUCTION_DATABASE_URL };

  const active = isSingleAccountModeActive(settings);

  expect(active).toBe(false);
});

it("keeps test credentials off when the database URL cannot be read", () => {
  const settings = { ...testMode, databaseUrl: "not a url" };

  const active = isSingleAccountModeActive(settings);

  expect(active).toBe(false);
});

// Regression: Mercado Pago test users get APP_USR- credentials that accept test cards, so outside the
// Vercel production deployment the prefix alone must not let the mode charge into another database.
it("keeps APP_USR- credentials off locally when the server writes to another database", () => {
  const settings = { ...testMode, ...appUserCredentials, databaseUrl: PRODUCTION_DATABASE_URL };

  const active = isSingleAccountModeActive(settings);

  expect(active).toBe(false);
});

it("keeps APP_USR- credentials off in a preview deployment without the test database", () => {
  const settings = { ...productionMode, deploymentEnvironment: "preview" };

  const active = isSingleAccountModeActive(settings);

  expect(active).toBe(false);
});

it("turns APP_USR- credentials on locally for the named test database", () => {
  const settings = { ...testMode, ...appUserCredentials };

  const active = isSingleAccountModeActive(settings);

  expect(active).toBe(true);
});

it("refuses test credentials in the Vercel production deployment even with the test database", () => {
  const settings = { ...testMode, deploymentEnvironment: "production" };

  const active = isSingleAccountModeActive(settings);

  expect(active).toBe(false);
});
