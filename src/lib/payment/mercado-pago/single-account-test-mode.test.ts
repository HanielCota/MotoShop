import { expect, it } from "vitest";

import { isSingleAccountTestModeActive, type SingleAccountTestModeSettings } from "./single-account-test-mode";

const TEST_HOST = "ep-teste-pagamento.sa-east-1.aws.neon.tech";

const active: SingleAccountTestModeSettings = {
  testDatabaseHost: TEST_HOST,
  databaseUrl: `postgresql://user:password@${TEST_HOST}/neondb?sslmode=require`,
  accessToken: "TEST-1234567890",
  publicKey: "TEST-00000000-0000-0000-0000-000000000000",
  deploymentEnvironment: undefined,
};

it("turns on only for the named test database, with TEST- credentials and outside production", () => {
  expect(isSingleAccountTestModeActive(active)).toBe(true);
  expect(isSingleAccountTestModeActive({ ...active, deploymentEnvironment: "preview" })).toBe(true);
  expect(isSingleAccountTestModeActive({ ...active, publicKey: undefined })).toBe(true);
  expect(isSingleAccountTestModeActive({ ...active, testDatabaseHost: ` ${TEST_HOST.toUpperCase()} ` })).toBe(true);
});

it("stays off without the test database variable", () => {
  expect(isSingleAccountTestModeActive({ ...active, testDatabaseHost: undefined })).toBe(false);
});

// Regression: a boolean flag left on with the .env.local database would mark test-card orders as paid in
// production; the mode now only runs against the database host it names.
it("stays off when the server writes to any other database, such as production", () => {
  expect(
    isSingleAccountTestModeActive({
      ...active,
      databaseUrl: "postgresql://user:password@ep-production.sa-east-1.aws.neon.tech/neondb",
    }),
  ).toBe(false);
  expect(isSingleAccountTestModeActive({ ...active, databaseUrl: "not a url" })).toBe(false);
});

it("refuses the Vercel production deployment even with test credentials and the test database", () => {
  expect(isSingleAccountTestModeActive({ ...active, deploymentEnvironment: "production" })).toBe(false);
});

it("refuses production credentials, a missing token and a Public Key from another environment", () => {
  expect(isSingleAccountTestModeActive({ ...active, accessToken: "APP_USR-1234567890" })).toBe(false);
  expect(isSingleAccountTestModeActive({ ...active, accessToken: undefined })).toBe(false);
  expect(isSingleAccountTestModeActive({ ...active, publicKey: "APP_USR-00000000-0000-0000-0000-000000000000" })).toBe(
    false,
  );
});
