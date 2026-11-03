/**
 * Single-account mode (decisions of 26/10 and 03/11/2026): until stores connect their own Mercado Pago
 * accounts, an order from the one store named by MERCADO_PAGO_SINGLE_ACCOUNT_SELLER_ID is charged on the
 * platform's own account, with no marketplace fee. Any other store, and any order with several stores,
 * stays refused.
 *
 * Production credentials charge real money into that account, which is the point in production.
 * TEST- credentials cannot move money but test cards mark orders as paid, so with them the mode is tied to
 * a test database: MERCADO_PAGO_TEST_MODE_DATABASE_HOST must name the host the server writes to, and the
 * Vercel production deployment is refused.
 */
const TEST_CREDENTIAL_PREFIX = "TEST-";
const PRODUCTION_DEPLOYMENT = "production";

/** The configured store, database and Mercado Pago credentials the mode is decided from. */
export type SingleAccountModeSettings = {
  sellerId: string | undefined;
  testDatabaseHost: string | undefined;
  databaseUrl: string;
  accessToken: string | undefined;
  publicKey: string | undefined;
  deploymentEnvironment: string | undefined;
};

/**
 * Tells which store the platform's Mercado Pago account may charge for.
 *
 * @param settings - The configured store, database and credentials.
 * @returns The id of that store, or null when the mode is off.
 */
export function singleAccountSellerId(settings: SingleAccountModeSettings): string | null {
  const sellerId = settings.sellerId?.trim();
  if (sellerId == null || sellerId === "") return null;
  if (settings.accessToken == null) return null;

  const testCredentials = isTestCredential(settings.accessToken);
  // Cards need the Public Key in the browser; it must belong to the same environment as the Access Token.
  if (settings.publicKey != null && isTestCredential(settings.publicKey) !== testCredentials) return null;
  if (testCredentials && isTestDatabase(settings) === false) return null;

  return sellerId;
}

function isTestDatabase(settings: SingleAccountModeSettings): boolean {
  if (settings.testDatabaseHost == null) return false;
  if (settings.deploymentEnvironment === PRODUCTION_DEPLOYMENT) return false;

  return databaseHostOf(settings.databaseUrl) === settings.testDatabaseHost.trim().toLowerCase();
}

function databaseHostOf(databaseUrl: string): string | null {
  if (URL.canParse(databaseUrl) === false) return null;

  return new URL(databaseUrl).hostname.toLowerCase();
}

function isTestCredential(credential: string): boolean {
  return credential.startsWith(TEST_CREDENTIAL_PREFIX);
}
