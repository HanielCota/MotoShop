/**
 * Single-account mode (decisions of 26/10 and 03/11/2026): until stores connect their own Mercado Pago
 * accounts, MERCADO_PAGO_SINGLE_ACCOUNT_MODE charges every order, from any store or from several stores, on
 * the platform's own account with one payment and no marketplace fee. Orders still record each store's
 * net and commission, which the platform pays out by hand.
 *
 * Production credentials charge real money into that account, which is the point in production.
 * TEST- credentials cannot move money but test cards mark orders as paid, so with them the mode is tied to
 * a test database: MERCADO_PAGO_TEST_MODE_DATABASE_HOST must name the host the server writes to, and the
 * Vercel production deployment is refused.
 */
const TEST_CREDENTIAL_PREFIX = "TEST-";
const PRODUCTION_DEPLOYMENT = "production";

/** The switch, database and Mercado Pago credentials the mode is decided from. */
export type SingleAccountModeSettings = {
  enabled: boolean | undefined;
  testDatabaseHost: string | undefined;
  databaseUrl: string;
  accessToken: string | undefined;
  publicKey: string | undefined;
  deploymentEnvironment: string | undefined;
};

/**
 * Tells whether the platform's Mercado Pago account may charge orders.
 *
 * @param settings - The switch, database and credentials in use.
 * @returns Whether orders are charged on the platform account.
 */
export function isSingleAccountModeActive(settings: SingleAccountModeSettings): boolean {
  if (settings.enabled !== true) return false;
  if (settings.accessToken == null) return false;

  const testCredentials = isTestCredential(settings.accessToken);
  // Cards need the Public Key in the browser; it must belong to the same environment as the Access Token.
  if (settings.publicKey != null && isTestCredential(settings.publicKey) !== testCredentials) return false;
  if (testCredentials) return isTestDatabase(settings);

  return true;
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
