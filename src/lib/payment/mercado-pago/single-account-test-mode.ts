/**
 * Single-account test mode (decision of 26/10/2026): with Mercado Pago TEST credentials, an order from
 * one store is charged on the platform's own test account, so the checkout can be tried end to end
 * before any seller connects a Mercado Pago account.
 *
 * Test cards mark orders as paid, so the mode is tied to a test database: it turns on only when
 * MERCADO_PAGO_TEST_MODE_DATABASE_HOST names the host the server is writing to. It also needs TEST-
 * credentials (which cannot move real money) and never turns on in the Vercel production deployment.
 */
const TEST_CREDENTIAL_PREFIX = "TEST-";
const PRODUCTION_DEPLOYMENT = "production";

export type SingleAccountTestModeSettings = {
  testDatabaseHost: string | undefined;
  databaseUrl: string;
  accessToken: string | undefined;
  publicKey: string | undefined;
  deploymentEnvironment: string | undefined;
};

export function isSingleAccountTestModeActive(settings: SingleAccountTestModeSettings): boolean {
  if (settings.testDatabaseHost == null) return false;
  if (settings.deploymentEnvironment === PRODUCTION_DEPLOYMENT) return false;
  if (databaseHostOf(settings.databaseUrl) !== settings.testDatabaseHost.trim().toLowerCase()) return false;
  if (isTestCredential(settings.accessToken) === false) return false;

  // Pix needs no Public Key; when one is set it must belong to the same test application.
  return settings.publicKey == null || isTestCredential(settings.publicKey);
}

function databaseHostOf(databaseUrl: string): string | null {
  if (URL.canParse(databaseUrl) === false) return null;

  return new URL(databaseUrl).hostname.toLowerCase();
}

function isTestCredential(credential: string | undefined): boolean {
  return credential != null && credential.startsWith(TEST_CREDENTIAL_PREFIX);
}
