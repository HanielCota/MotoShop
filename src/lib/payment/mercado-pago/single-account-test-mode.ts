/**
 * Single-account test mode (decision of 26/10/2026): with Mercado Pago TEST credentials, an order from
 * one store is charged on the platform's own test account, so the checkout can be tried end to end
 * before any seller connects a Mercado Pago account. Test credentials cannot move real money, and the
 * mode never turns on in the Vercel production deployment, where test cards would mark orders as paid.
 */
const TEST_CREDENTIAL_PREFIX = "TEST-";
const PRODUCTION_DEPLOYMENT = "production";

export type SingleAccountTestModeSettings = {
  enabled: boolean | undefined;
  accessToken: string | undefined;
  publicKey: string | undefined;
  deploymentEnvironment: string | undefined;
};

export function isSingleAccountTestModeActive(settings: SingleAccountTestModeSettings): boolean {
  if (settings.enabled !== true) return false;
  if (settings.deploymentEnvironment === PRODUCTION_DEPLOYMENT) return false;
  if (isTestCredential(settings.accessToken) === false) return false;

  // Pix needs no Public Key; when one is set it must belong to the same test application.
  return settings.publicKey == null || isTestCredential(settings.publicKey);
}

function isTestCredential(credential: string | undefined): boolean {
  return credential != null && credential.startsWith(TEST_CREDENTIAL_PREFIX);
}
