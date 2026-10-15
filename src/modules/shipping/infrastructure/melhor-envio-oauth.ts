import "server-only";

import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { env } from "@/config/env";
import { db } from "@/lib/database";
import { logger } from "@/lib/logger";
import { ApplicationError } from "@/shared/errors/application-error";

const DEFAULT_API_URL = "https://sandbox.melhorenvio.com.br";
/**
 * Permissões pedidas na conexão da loja. Precisam cobrir todo o fluxo usado pelo código:
 * cotação (checkout), compra no carrinho + checkout, geração da etiqueta, rastreio e a
 * conferência de compras/gerações com resultado incerto (consulta de pedidos).
 * `cart-read` e `shipping-print` não são solicitados porque nenhum fluxo os utiliza.
 */
export const MELHOR_ENVIO_REQUESTED_SCOPES = [
  "shipping-calculate",
  "cart-write",
  "shipping-checkout",
  "shipping-generate",
  "shipping-tracking",
  "orders-read",
] as const;
const REQUESTED_SCOPES = MELHOR_ENVIO_REQUESTED_SCOPES;
const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.coerce.number().int().positive(),
  refresh_token_expires_in: z.coerce.number().int().positive().optional(),
  user_id: z.union([z.string(), z.number()]).optional(),
  scope: z.string().optional(),
});

type OAuthState = { userId: string; sellerId: string; nonce: string; expiresAt: number };

export function isMelhorEnvioOAuthConfigured(): boolean {
  return Boolean(
    env.MELHOR_ENVIO_CLIENT_ID &&
    env.MELHOR_ENVIO_CLIENT_SECRET &&
    env.MELHOR_ENVIO_REDIRECT_URI &&
    env.MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY,
  );
}

export function createMelhorEnvioAuthorizationUrl(input: { userId: string; sellerId: string }) {
  const oauth = requireOAuthConfig();
  const state = signState({
    ...input,
    nonce: randomBytes(24).toString("base64url"),
    expiresAt: Date.now() + 10 * 60_000,
  });
  const url = new URL("/oauth/authorize", env.MELHOR_ENVIO_API_URL ?? DEFAULT_API_URL);
  url.searchParams.set("client_id", oauth.clientId);
  url.searchParams.set("redirect_uri", oauth.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("scope", REQUESTED_SCOPES.join(" "));
  return { url: url.toString(), state };
}

function tryDecodeBase64Url(value: string): Buffer | null {
  try {
    return Buffer.from(value, "base64url");
  } catch {
    return null;
  }
}

export function verifyMelhorEnvioState(value: string): OAuthState | null {
  const [encoded, signature, extra] = value.split(".");
  if (!encoded || !signature || extra) return null;
  const expected = createHmac("sha256", stateSigningKey()).update(encoded).digest();
  const received = tryDecodeBase64Url(signature);
  if (!received) return null;
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthState;
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.sellerId !== "string" ||
      typeof parsed.nonce !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= Date.now()
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function exchangeMelhorEnvioAuthorizationCode(code: string, sellerId: string) {
  const oauth = requireOAuthConfig();
  const response = await fetch(`${env.MELHOR_ENVIO_API_URL ?? DEFAULT_API_URL}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": env.MELHOR_ENVIO_USER_AGENT ?? "O Moto Shop (suporte@motoshopbrasil.com.br)",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
      redirect_uri: oauth.redirectUri,
      code,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const raw: unknown = await response.json().catch(() => null);
  const parsed = tokenResponseSchema.safeParse(raw);
  if (!response.ok || !parsed.success) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Não foi possível conectar a conta do Melhor Envio. Tente autorizar novamente.",
      statusCode: response.status >= 500 ? 502 : 409,
    });
  }

  return toStoredTokenData(parsed.data, sellerId);
}

export async function getSellerMelhorEnvioAccessToken(
  sellerId: string,
  requiredScopes: readonly string[] = [],
): Promise<string | null> {
  const integration = await db.sellerShippingIntegration.findUnique({ where: { sellerId } });
  if (!integration) return null;
  const oauth = requireOAuthConfig();
  assertRequiredScopes(integration.scopes, requiredScopes);

  const refreshBefore = Date.now() + 2 * 60_000;
  if (integration.accessTokenExpiresAt.getTime() > refreshBefore) {
    return decryptToken(integration.accessTokenEncrypted, sellerId);
  }
  assertRefreshTokenNotExpired(integration.refreshTokenExpiresAt);

  const leaseAcquired = await acquireRefreshLease(integration.id);
  if (!leaseAcquired) return waitForConcurrentRefresh(sellerId, refreshBefore);

  return refreshAccessTokenWithLease({ integrationId: integration.id, sellerId, refreshBefore, oauth });
}

type OAuthConfig = ReturnType<typeof requireOAuthConfig>;

function assertRefreshTokenNotExpired(refreshTokenExpiresAt: Date): void {
  if (refreshTokenExpiresAt.getTime() > Date.now()) return;
  throw new ApplicationError({
    code: "CONFIGURATION_ERROR",
    message: "A autorização do Melhor Envio expirou. Reconecte a conta da loja.",
    statusCode: 409,
  });
}

async function acquireRefreshLease(integrationId: string): Promise<boolean> {
  const leaseUntil = new Date(Date.now() + 20_000);
  const lease = await db.sellerShippingIntegration.updateMany({
    where: {
      id: integrationId,
      OR: [{ refreshLeaseUntil: null }, { refreshLeaseUntil: { lte: new Date() } }],
    },
    data: { refreshLeaseUntil: leaseUntil },
  });
  return lease.count !== 0;
}

/** Outra requisição detém o lease: aguarda o token renovado por ela, sem renovar em paralelo. */
async function waitForConcurrentRefresh(sellerId: string, refreshBefore: number): Promise<string | null> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const updated = await db.sellerShippingIntegration.findUnique({ where: { sellerId } });
    if (!updated) return null;
    if (updated.accessTokenExpiresAt.getTime() > refreshBefore)
      return decryptToken(updated.accessTokenEncrypted, sellerId);
    if (!updated.refreshLeaseUntil || updated.refreshLeaseUntil.getTime() <= Date.now()) break;
  }
  throw new ApplicationError({
    code: "CONFLICT",
    message: "A renovação do acesso ao Melhor Envio está em andamento. Tente novamente em instantes.",
    statusCode: 503,
  });
}

async function refreshAccessTokenWithLease(input: {
  integrationId: string;
  sellerId: string;
  refreshBefore: number;
  oauth: OAuthConfig;
}): Promise<string | null> {
  try {
    // Outra requisição pode ter renovado o token entre a leitura inicial e a obtenção do lease:
    // relê a integração para não gastar (e invalidar) o refresh token já rotacionado.
    const current = await db.sellerShippingIntegration.findUnique({ where: { sellerId: input.sellerId } });
    if (!current) {
      await releaseRefreshLease(input.integrationId, input.sellerId);
      return null;
    }
    if (current.accessTokenExpiresAt.getTime() > input.refreshBefore) {
      await releaseRefreshLease(input.integrationId, input.sellerId);
      return decryptToken(current.accessTokenEncrypted, input.sellerId);
    }
    const token = await requestRefreshedToken(input.oauth, decryptToken(current.refreshTokenEncrypted, input.sellerId));
    await db.sellerShippingIntegration.update({
      where: { id: input.integrationId },
      data: { ...toStoredTokenData(token, input.sellerId), refreshLeaseUntil: null },
    });
    return token.access_token;
  } catch (error) {
    await releaseRefreshLease(input.integrationId, input.sellerId);
    throw error;
  }
}

async function requestRefreshedToken(oauth: OAuthConfig, refreshToken: string) {
  const response = await fetch(`${env.MELHOR_ENVIO_API_URL ?? DEFAULT_API_URL}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": env.MELHOR_ENVIO_USER_AGENT ?? "O Moto Shop (suporte@motoshopbrasil.com.br)",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
      refresh_token: refreshToken,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const raw: unknown = await response.json().catch(() => null);
  const parsed = tokenResponseSchema.safeParse(raw);
  if (!response.ok || !parsed.success) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Não foi possível renovar a conexão do Melhor Envio. Reconecte a conta da loja.",
      statusCode: response.status >= 500 ? 502 : 409,
    });
  }

  return parsed.data;
}

async function releaseRefreshLease(integrationId: string, sellerId: string): Promise<void> {
  try {
    await db.sellerShippingIntegration.updateMany({
      where: { id: integrationId },
      data: { refreshLeaseUntil: null },
    });
  } catch (releaseError) {
    logger.error({ event: "shipping.token_refresh_lease_release_failed", sellerId, error: releaseError });
  }
}

export async function getSellerMelhorEnvioAccessTokenWithScopes(
  sellerId: string,
  requiredScopes: readonly string[],
): Promise<string | null> {
  return getSellerMelhorEnvioAccessToken(sellerId, requiredScopes);
}

function assertRequiredScopes(scopes: string, requiredScopes: readonly string[]): void {
  if (requiredScopes.length === 0) return;
  const grantedScopes = new Set(scopes.split(/\s+/).filter(Boolean));
  const missingScopes = requiredScopes.filter((scope) => !grantedScopes.has(scope));
  const ecommerceShippingCoversCartAndCheckout =
    grantedScopes.has("ecommerce-shipping") &&
    requiredScopes.every((scope) => ["cart-write", "shipping-checkout"].includes(scope));
  if (missingScopes.length > 0 && !ecommerceShippingCoversCartAndCheckout) {
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message: `A integração do Melhor Envio não autorizou as permissões necessárias (${missingScopes.join(", ")}). Reconecte a conta após habilitá-las.`,
      statusCode: 409,
    });
  }
}

const TOKEN_FORMAT_VERSION = "v2";
const AUTH_TAG_BYTES = 16;

/**
 * L-13: tokens are encrypted with AES-256-GCM bound to the seller (sellerId as additional
 * authenticated data), so a ciphertext copied to another seller's row does not decrypt, and the
 * 16-byte tag length is enforced. Values written before (three parts, no AAD) still decrypt and
 * are re-encrypted at the next token refresh.
 */
export function encryptToken(token: string, sellerId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv, { authTagLength: AUTH_TAG_BYTES });
  cipher.setAAD(Buffer.from(sellerId, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const parts = [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url"));
  return [TOKEN_FORMAT_VERSION, ...parts].join(".");
}

export function decryptToken(value: string, sellerId: string): string {
  const parts = value.split(".");
  const versioned = parts[0] === TOKEN_FORMAT_VERSION;
  const [ivValue, authTagValue, ciphertextValue, extra] = versioned ? parts.slice(1) : parts;
  if (!ivValue || !authTagValue || !ciphertextValue || extra) throw invalidStoredToken();
  const authTag = Buffer.from(authTagValue, "base64url");
  if (authTag.length !== AUTH_TAG_BYTES) throw invalidStoredToken();
  try {
    const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivValue, "base64url"), {
      authTagLength: AUTH_TAG_BYTES,
    });
    if (versioned) decipher.setAAD(Buffer.from(sellerId, "utf8"));
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    throw invalidStoredToken();
  }
}

export async function persistMelhorEnvioConnection(
  sellerId: string,
  tokenData: Awaited<ReturnType<typeof exchangeMelhorEnvioAuthorizationCode>>,
) {
  await db.sellerShippingIntegration.upsert({
    where: { sellerId },
    create: { sellerId, ...tokenData },
    update: { ...tokenData, connectedAt: new Date(), refreshLeaseUntil: null },
  });
}

/**
 * L-13: the state is signed with a key derived from the server secret for this purpose only, so
 * the Better Auth secret is never used directly as an HMAC key here.
 */
function stateSigningKey(): Buffer {
  return createHmac("sha256", env.BETTER_AUTH_SECRET).update("motoshop:melhor-envio-oauth-state:v1").digest();
}

function signState(state: OAuthState): string {
  const encoded = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signature = createHmac("sha256", stateSigningKey()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function toStoredTokenData(token: z.infer<typeof tokenResponseSchema>, sellerId: string) {
  const now = Date.now();
  return {
    accountId: token.user_id === undefined ? null : String(token.user_id),
    accessTokenEncrypted: encryptToken(token.access_token, sellerId),
    refreshTokenEncrypted: encryptToken(token.refresh_token, sellerId),
    scopes: token.scope ?? REQUESTED_SCOPES.join(" "),
    accessTokenExpiresAt: new Date(now + token.expires_in * 1000),
    refreshTokenExpiresAt: new Date(now + (token.refresh_token_expires_in ?? 45 * 24 * 60 * 60) * 1000),
  };
}

function requireOAuthConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = env.MELHOR_ENVIO_CLIENT_ID;
  const clientSecret = env.MELHOR_ENVIO_CLIENT_SECRET;
  const redirectUri = env.MELHOR_ENVIO_REDIRECT_URI;
  if (!isMelhorEnvioOAuthConfigured() || !clientId || !clientSecret || !redirectUri) {
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message: "A integração do Melhor Envio ainda não está configurada neste ambiente.",
      statusCode: 503,
    });
  }

  return { clientId, clientSecret, redirectUri };
}

function getEncryptionKey(): Buffer {
  const encoded = env.MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY;
  if (!encoded)
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message: "Chave de criptografia não configurada.",
      statusCode: 503,
    });
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32)
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message: "Chave de criptografia inválida.",
      statusCode: 503,
    });
  return key;
}

function invalidStoredToken() {
  return new ApplicationError({
    code: "CONFIGURATION_ERROR",
    message: "Não foi possível proteger os tokens do Melhor Envio.",
    statusCode: 503,
  });
}
