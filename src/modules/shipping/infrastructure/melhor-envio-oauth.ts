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
  assertOAuthConfigured();
  const state = signState({
    ...input,
    nonce: randomBytes(24).toString("base64url"),
    expiresAt: Date.now() + 10 * 60_000,
  });
  const url = new URL("/oauth/authorize", env.MELHOR_ENVIO_API_URL ?? DEFAULT_API_URL);
  url.searchParams.set("client_id", env.MELHOR_ENVIO_CLIENT_ID!);
  url.searchParams.set("redirect_uri", env.MELHOR_ENVIO_REDIRECT_URI!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("scope", REQUESTED_SCOPES.join(" "));
  return { url: url.toString(), state };
}

export function verifyMelhorEnvioState(value: string): OAuthState | null {
  const [encoded, signature, extra] = value.split(".");
  if (!encoded || !signature || extra) return null;
  const expected = createHmac("sha256", env.BETTER_AUTH_SECRET).update(encoded).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
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

export async function exchangeMelhorEnvioAuthorizationCode(code: string) {
  assertOAuthConfigured();
  const response = await fetch(`${env.MELHOR_ENVIO_API_URL ?? DEFAULT_API_URL}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": env.MELHOR_ENVIO_USER_AGENT ?? "O Moto Shop (suporte@motoshopbrasil.com.br)",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: env.MELHOR_ENVIO_CLIENT_ID!,
      client_secret: env.MELHOR_ENVIO_CLIENT_SECRET!,
      redirect_uri: env.MELHOR_ENVIO_REDIRECT_URI!,
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

  return toStoredTokenData(parsed.data);
}

export async function getSellerMelhorEnvioAccessToken(
  sellerId: string,
  requiredScopes: readonly string[] = [],
): Promise<string | null> {
  const integration = await db.sellerShippingIntegration.findUnique({ where: { sellerId } });
  if (!integration) return null;
  assertOAuthConfigured();
  assertRequiredScopes(integration.scopes, requiredScopes);

  const refreshBefore = Date.now() + 2 * 60_000;
  if (integration.accessTokenExpiresAt.getTime() > refreshBefore) {
    return decryptToken(integration.accessTokenEncrypted);
  }
  if (integration.refreshTokenExpiresAt.getTime() <= Date.now()) {
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message: "A autorização do Melhor Envio expirou. Reconecte a conta da loja.",
      statusCode: 409,
    });
  }

  const leaseUntil = new Date(Date.now() + 20_000);
  const lease = await db.sellerShippingIntegration.updateMany({
    where: {
      id: integration.id,
      OR: [{ refreshLeaseUntil: null }, { refreshLeaseUntil: { lte: new Date() } }],
    },
    data: { refreshLeaseUntil: leaseUntil },
  });
  if (lease.count === 0) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const updated = await db.sellerShippingIntegration.findUnique({ where: { sellerId } });
      if (!updated) return null;
      if (updated.accessTokenExpiresAt.getTime() > refreshBefore) return decryptToken(updated.accessTokenEncrypted);
      if (!updated.refreshLeaseUntil || updated.refreshLeaseUntil.getTime() <= Date.now()) break;
    }
    throw new ApplicationError({
      code: "CONFLICT",
      message: "A renovação do acesso ao Melhor Envio está em andamento. Tente novamente em instantes.",
      statusCode: 503,
    });
  }

  try {
    // Outra requisição pode ter renovado o token entre a leitura inicial e a obtenção do lease:
    // relê a integração para não gastar (e invalidar) o refresh token já rotacionado.
    const current = await db.sellerShippingIntegration.findUnique({ where: { sellerId } });
    if (!current) {
      await releaseRefreshLease(integration.id, sellerId);
      return null;
    }
    if (current.accessTokenExpiresAt.getTime() > refreshBefore) {
      await releaseRefreshLease(integration.id, sellerId);
      return decryptToken(current.accessTokenEncrypted);
    }
    const refreshToken = decryptToken(current.refreshTokenEncrypted);
    const response = await fetch(`${env.MELHOR_ENVIO_API_URL ?? DEFAULT_API_URL}/oauth/token`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": env.MELHOR_ENVIO_USER_AGENT ?? "O Moto Shop (suporte@motoshopbrasil.com.br)",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: env.MELHOR_ENVIO_CLIENT_ID!,
        client_secret: env.MELHOR_ENVIO_CLIENT_SECRET!,
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
    const data = toStoredTokenData(parsed.data);
    await db.sellerShippingIntegration.update({
      where: { id: integration.id },
      data: { ...data, refreshLeaseUntil: null },
    });
    return parsed.data.access_token;
  } catch (error) {
    await releaseRefreshLease(integration.id, sellerId);
    throw error;
  }
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

export function encryptToken(token: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptToken(value: string): string {
  const [ivValue, authTagValue, ciphertextValue, extra] = value.split(".");
  if (!ivValue || !authTagValue || !ciphertextValue || extra) throw invalidStoredToken();
  try {
    const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));
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

function signState(state: OAuthState): string {
  const encoded = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signature = createHmac("sha256", env.BETTER_AUTH_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function toStoredTokenData(token: z.infer<typeof tokenResponseSchema>) {
  const now = Date.now();
  return {
    accountId: token.user_id === undefined ? null : String(token.user_id),
    accessTokenEncrypted: encryptToken(token.access_token),
    refreshTokenEncrypted: encryptToken(token.refresh_token),
    scopes: token.scope ?? REQUESTED_SCOPES.join(" "),
    accessTokenExpiresAt: new Date(now + token.expires_in * 1000),
    refreshTokenExpiresAt: new Date(now + (token.refresh_token_expires_in ?? 45 * 24 * 60 * 60) * 1000),
  };
}

function assertOAuthConfigured(): void {
  if (!isMelhorEnvioOAuthConfigured()) {
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message: "A integração do Melhor Envio ainda não está configurada neste ambiente.",
      statusCode: 503,
    });
  }
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
