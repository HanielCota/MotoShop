import { expect, it } from "vitest";

import { singleAccountSellerId, type SingleAccountModeSettings } from "./single-account-mode";

const SELLER_ID = "seller-luiz-parts";
const TEST_HOST = "ep-teste-pagamento.sa-east-1.aws.neon.tech";
const PRODUCTION_DATABASE_URL = "postgresql://user:password@ep-production.sa-east-1.aws.neon.tech/neondb";

const testMode: SingleAccountModeSettings = {
  sellerId: SELLER_ID,
  testDatabaseHost: TEST_HOST,
  databaseUrl: `postgresql://user:password@${TEST_HOST}/neondb?sslmode=require`,
  accessToken: "TEST-1234567890",
  publicKey: "TEST-00000000-0000-0000-0000-000000000000",
  deploymentEnvironment: undefined,
};

const productionMode: SingleAccountModeSettings = {
  sellerId: SELLER_ID,
  testDatabaseHost: undefined,
  databaseUrl: PRODUCTION_DATABASE_URL,
  accessToken: "APP_USR-1234567890",
  publicKey: "APP_USR-00000000-0000-0000-0000-000000000000",
  deploymentEnvironment: "production",
};

it("stays off without a configured store, in test and in production", () => {
  expect(singleAccountSellerId({ ...testMode, sellerId: undefined })).toBeNull();
  expect(singleAccountSellerId({ ...productionMode, sellerId: undefined })).toBeNull();
  expect(singleAccountSellerId({ ...productionMode, sellerId: "   " })).toBeNull();
});

it("charges the configured store with production credentials in the Vercel production deployment", () => {
  expect(singleAccountSellerId(productionMode)).toBe(SELLER_ID);
  expect(singleAccountSellerId({ ...productionMode, sellerId: ` ${SELLER_ID} ` })).toBe(SELLER_ID);
  expect(singleAccountSellerId({ ...productionMode, publicKey: undefined })).toBe(SELLER_ID);
});

it("refuses a missing token and a Public Key from the other environment", () => {
  expect(singleAccountSellerId({ ...productionMode, accessToken: undefined })).toBeNull();
  expect(singleAccountSellerId({ ...productionMode, publicKey: testMode.publicKey })).toBeNull();
  expect(singleAccountSellerId({ ...testMode, publicKey: productionMode.publicKey })).toBeNull();
});

it("turns test credentials on only for the named test database, outside production", () => {
  expect(singleAccountSellerId(testMode)).toBe(SELLER_ID);
  expect(singleAccountSellerId({ ...testMode, deploymentEnvironment: "preview" })).toBe(SELLER_ID);
  expect(singleAccountSellerId({ ...testMode, publicKey: undefined })).toBe(SELLER_ID);
  expect(singleAccountSellerId({ ...testMode, testDatabaseHost: ` ${TEST_HOST.toUpperCase()} ` })).toBe(SELLER_ID);
});

it("keeps test credentials off without the test database variable", () => {
  expect(singleAccountSellerId({ ...testMode, testDatabaseHost: undefined })).toBeNull();
});

// Regression: a boolean flag left on with the .env.local database would mark test-card orders as paid in
// production; test credentials now only run against the database host the mode names.
it("keeps test credentials off when the server writes to any other database, such as production", () => {
  expect(singleAccountSellerId({ ...testMode, databaseUrl: PRODUCTION_DATABASE_URL })).toBeNull();
  expect(singleAccountSellerId({ ...testMode, databaseUrl: "not a url" })).toBeNull();
});

it("refuses test credentials in the Vercel production deployment even with the test database", () => {
  expect(singleAccountSellerId({ ...testMode, deploymentEnvironment: "production" })).toBeNull();
});
