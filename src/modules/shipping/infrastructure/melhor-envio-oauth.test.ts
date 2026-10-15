import { createCipheriv, randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), updateMany: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/config/env", () => ({
  env: {
    BETTER_AUTH_SECRET: "x".repeat(32),
    MELHOR_ENVIO_CLIENT_ID: "12345",
    MELHOR_ENVIO_CLIENT_SECRET: "sandbox-secret",
    MELHOR_ENVIO_REDIRECT_URI: "http://localhost:3000/api/shipping/melhor-envio/callback",
    MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    MELHOR_ENVIO_API_URL: "https://sandbox.melhorenvio.com.br",
    MELHOR_ENVIO_USER_AGENT: "O Moto Shop (teste@example.com)",
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
  },
}));
vi.mock("@/lib/database", () => ({
  db: { sellerShippingIntegration: { upsert: vi.fn(), findUnique: mocks.findUnique, updateMany: mocks.updateMany } },
}));

import {
  createMelhorEnvioAuthorizationUrl,
  decryptToken,
  exchangeMelhorEnvioAuthorizationCode,
  encryptToken,
  getSellerMelhorEnvioAccessTokenWithScopes,
  verifyMelhorEnvioState,
} from "./melhor-envio-oauth";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  mocks.findUnique.mockReset();
  mocks.updateMany.mockReset();
});

describe("Melhor Envio OAuth", () => {
  it("requests every permission used by quote, purchase, generation, tracking and reconciliation", () => {
    const { url, state } = createMelhorEnvioAuthorizationUrl({ userId: "user-1", sellerId: "seller-1" });
    const authorization = new URL(url);

    expect(authorization.origin).toBe("https://sandbox.melhorenvio.com.br");
    expect(authorization.searchParams.get("scope")?.split(" ")).toEqual([
      "shipping-calculate",
      "cart-write",
      "shipping-checkout",
      "shipping-generate",
      "shipping-tracking",
      "orders-read",
    ]);
    expect(verifyMelhorEnvioState(state)).toMatchObject({ userId: "user-1", sellerId: "seller-1" });
    expect(verifyMelhorEnvioState(`${state}x`)).toBeNull();
  });

  it("does not provide a token for label purchase when OAuth granted only quote scope", async () => {
    mocks.findUnique.mockResolvedValueOnce({ scopes: "shipping-calculate" });

    await expect(
      getSellerMelhorEnvioAccessTokenWithScopes("seller-1", ["cart-write", "shipping-checkout"]),
    ).rejects.toMatchObject({ code: "CONFIGURATION_ERROR" });
    expect(mocks.findUnique).toHaveBeenCalledOnce();
  });

  it("allows a seller token only after required scopes have been granted", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      scopes: "cart-write shipping-checkout",
      accessTokenExpiresAt: new Date(Date.now() + 5 * 60_000),
      refreshTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60_000),
      accessTokenEncrypted: encryptToken("seller-sandbox-token", "seller-1"),
    });

    await expect(
      getSellerMelhorEnvioAccessTokenWithScopes("seller-1", ["cart-write", "shipping-checkout"]),
    ).resolves.toBe("seller-sandbox-token");
    expect(mocks.findUnique).toHaveBeenCalledOnce();
  });

  it("accepts the provider's ecommerce-shipping scope for cart and checkout operations", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      scopes: "ecommerce-shipping",
      accessTokenExpiresAt: new Date(Date.now() + 5 * 60_000),
      refreshTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60_000),
      accessTokenEncrypted: encryptToken("seller-sandbox-token", "seller-1"),
    });

    await expect(
      getSellerMelhorEnvioAccessTokenWithScopes("seller-1", ["cart-write", "shipping-checkout"]),
    ).resolves.toBe("seller-sandbox-token");
  });

  it("reuses a token refreshed by a concurrent request after acquiring the refresh lease", async () => {
    const integration = {
      id: "integration-1",
      scopes: "cart-write shipping-checkout",
      accessTokenExpiresAt: new Date(Date.now() + 30_000),
      refreshTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60_000),
      accessTokenEncrypted: encryptToken("stale-token", "seller-1"),
      refreshTokenEncrypted: encryptToken("already-rotated-refresh-token", "seller-1"),
    };
    mocks.findUnique.mockResolvedValueOnce(integration).mockResolvedValueOnce({
      ...integration,
      accessTokenExpiresAt: new Date(Date.now() + 60 * 60_000),
      accessTokenEncrypted: encryptToken("fresh-token", "seller-1"),
    });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getSellerMelhorEnvioAccessTokenWithScopes("seller-1", ["cart-write", "shipping-checkout"]),
    ).resolves.toBe("fresh-token");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.updateMany).toHaveBeenLastCalledWith({
      where: { id: "integration-1" },
      data: { refreshLeaseUntil: null },
    });
  });

  it("rejects OAuth state at the exact expiration boundary", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const { state } = createMelhorEnvioAuthorizationUrl({ userId: "user-1", sellerId: "seller-1" });

    now.mockReturnValue(601_000);

    expect(verifyMelhorEnvioState(state)).toBeNull();
  });

  it("encrypts tokens with authenticated encryption and rejects tampering", () => {
    const encrypted = encryptToken("private-seller-token", "seller-1");
    expect(encrypted).not.toContain("private-seller-token");
    expect(decryptToken(encrypted, "seller-1")).toBe("private-seller-token");

    const [version, iv, authTag, ciphertext] = encrypted.split(".");
    const changedAuthTag = `${authTag?.startsWith("A") ? "B" : "A"}${authTag?.slice(1)}`;
    const tampered = `${version}.${iv}.${changedAuthTag}.${ciphertext}`;
    expect(() => decryptToken(tampered, "seller-1")).toThrow();
  });

  it("binds a stored token to its seller, so a copied ciphertext does not decrypt elsewhere (L-13)", () => {
    const encrypted = encryptToken("private-seller-token", "seller-1");

    expect(encrypted.startsWith("v2.")).toBe(true);
    expect(() => decryptToken(encrypted, "seller-2")).toThrow();
  });

  it("still reads tokens stored in the previous format until the next refresh (L-13)", () => {
    // Previous format: iv.tag.ciphertext, no seller-bound AAD, same key as the env mock above.
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", Buffer.alloc(32, 7), iv);
    const ciphertext = Buffer.concat([cipher.update("legacy-token", "utf8"), cipher.final()]);
    const legacy = [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");

    expect(decryptToken(legacy, "seller-1")).toBe("legacy-token");
  });

  it("exchanges an authorization code server-to-server and only returns encrypted tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      Response.json({
        access_token: "seller-access-token",
        refresh_token: "seller-refresh-token",
        expires_in: 3600,
        refresh_token_expires_in: 86400,
        user_id: 123,
        scope: "shipping-calculate",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const tokenData = await exchangeMelhorEnvioAuthorizationCode("one-time-code", "seller-1");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(String(init.body));

    expect(url).toBe("https://sandbox.melhorenvio.com.br/oauth/token");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/x-www-form-urlencoded" });
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("client_secret")).toBe("sandbox-secret");
    expect(body.get("code")).toBe("one-time-code");
    expect(tokenData).toMatchObject({ accountId: "123", scopes: "shipping-calculate" });
    expect(decryptToken(tokenData.accessTokenEncrypted, "seller-1")).toBe("seller-access-token");
    expect(decryptToken(tokenData.refreshTokenEncrypted, "seller-1")).toBe("seller-refresh-token");
  });

  it("rejects an incomplete token response without persisting a connection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ access_token: "incomplete" })));

    await expect(exchangeMelhorEnvioAuthorizationCode("one-time-code", "seller-1")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});
