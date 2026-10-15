import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchange: vi.fn(),
  findMember: vi.fn(),
  getSession: vi.fn(),
  hasPermission: vi.fn(),
  logError: vi.fn(),
  persist: vi.fn(),
  verifyState: vi.fn(),
}));

vi.mock("@/config/env", () => ({ env: { NODE_ENV: "test" } }));
vi.mock("@/config/get-application-base-url", () => ({ getApplicationBaseUrl: () => "http://localhost:3000" }));
vi.mock("@/lib/database", () => ({ db: { sellerMember: { findFirst: mocks.findMember } } }));
vi.mock("@/lib/logger", () => ({ logger: { error: mocks.logError } }));
vi.mock("@/modules/auth/application/authorization", () => ({ getCurrentSession: mocks.getSession }));
vi.mock("@/modules/auth/domain/seller-permissions", () => ({ hasSellerPermission: mocks.hasPermission }));
vi.mock("@/modules/shipping/infrastructure/melhor-envio-oauth", () => ({
  exchangeMelhorEnvioAuthorizationCode: mocks.exchange,
  persistMelhorEnvioConnection: mocks.persist,
  verifyMelhorEnvioState: mocks.verifyState,
}));

import { NextRequest } from "next/server";

import { GET } from "./route";

const stateValue = "signed-state";
const state = { userId: "user-1", sellerId: "seller-1", nonce: "nonce", expiresAt: Date.now() + 60_000 };
const callbackPath = "/api/shipping/melhor-envio/callback";

function createRequest(query: string, cookie?: string) {
  const url = `http://localhost:3000${callbackPath}${query}`;
  if (cookie === undefined) return new NextRequest(url);
  return new NextRequest(url, { headers: { cookie: `melhor-envio-oauth-state=${cookie}` } });
}

function redirectedTo(response: Response) {
  const location = response.headers.get("location");
  if (!location) throw new Error("OAuth callback did not return a redirect location");
  return new URL(location);
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.verifyState.mockReturnValue(state);
  mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
  mocks.findMember.mockResolvedValue({ role: "OWNER" });
  mocks.hasPermission.mockReturnValue(true);
  mocks.exchange.mockResolvedValue({
    accessTokenEncrypted: "encrypted-access",
    refreshTokenEncrypted: "encrypted-refresh",
  });
  mocks.persist.mockResolvedValue(undefined);
});

describe("Melhor Envio OAuth callback", () => {
  it("rejects a missing state cookie and clears the short-lived state cookie", async () => {
    const response = await GET(createRequest("?code=one-time-code"));

    expect(response.status).toBe(307);
    expect(redirectedTo(response).searchParams.get("shipping")).toBe("authorization_failed");
    expect(response.headers.get("set-cookie")).toContain("melhor-envio-oauth-state=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it("rejects a state value that does not match the httpOnly cookie", async () => {
    const response = await GET(createRequest(`?code=one-time-code&state=${stateValue}`, "different-state"));

    expect(redirectedTo(response).searchParams.get("shipping")).toBe("authorization_failed");
    expect(mocks.verifyState).not.toHaveBeenCalled();
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("rejects an authorization denial before exchanging a code", async () => {
    const response = await GET(createRequest(`?error=access_denied&state=${stateValue}`, stateValue));

    expect(redirectedTo(response).searchParams.get("shipping")).toBe("authorization_failed");
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it("does not connect a seller when the original user session has changed", async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: "different-user" } });

    const response = await GET(createRequest(`?code=one-time-code&state=${stateValue}`, stateValue));

    expect(redirectedTo(response).searchParams.get("shipping")).toBe("session_expired");
    expect(mocks.findMember).not.toHaveBeenCalled();
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("requires current seller-management permission before exchanging a code", async () => {
    mocks.findMember.mockResolvedValueOnce({ role: "ORDERS" });
    mocks.hasPermission.mockReturnValueOnce(false);

    const response = await GET(createRequest(`?code=one-time-code&state=${stateValue}`, stateValue));

    expect(redirectedTo(response).searchParams.get("shipping")).toBe("permission_denied");
    expect(mocks.findMember).toHaveBeenCalledWith({
      where: { sellerId: "seller-1", userId: "user-1", seller: { status: { in: ["APPROVED", "ACTIVE"] } } },
      select: { role: true },
    });
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("rejects a missing or oversized authorization code", async () => {
    const missingCodeResponse = await GET(createRequest(`?state=${stateValue}`, stateValue));
    const oversizedCodeResponse = await GET(createRequest(`?state=${stateValue}&code=${"x".repeat(2049)}`, stateValue));

    expect(redirectedTo(missingCodeResponse).searchParams.get("shipping")).toBe("authorization_failed");
    expect(redirectedTo(oversizedCodeResponse).searchParams.get("shipping")).toBe("authorization_failed");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("persists tokens only after verifying the session and seller, then redirects as connected", async () => {
    const response = await GET(createRequest(`?code=one-time-code&state=${stateValue}`, stateValue));

    expect(redirectedTo(response).searchParams.get("shipping")).toBe("connected");
    expect(mocks.exchange).toHaveBeenCalledWith("one-time-code");
    expect(mocks.persist).toHaveBeenCalledWith("seller-1", expect.anything());
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(mocks.exchange.mock.invocationCallOrder[0]).toBeLessThan(defined(mocks.persist.mock.invocationCallOrder[0]));
  });

  it("returns a generic failure and logs only safe metadata when exchange or persistence fails", async () => {
    const sensitiveMessage = "access_token=must-not-be-logged";
    mocks.exchange.mockRejectedValueOnce(new Error(sensitiveMessage));

    const response = await GET(createRequest(`?code=one-time-code&state=${stateValue}`, stateValue));

    expect(redirectedTo(response).searchParams.get("shipping")).toBe("authorization_failed");
    expect(mocks.logError).toHaveBeenCalledWith({
      event: "shipping.melhor_envio_oauth.callback_failed",
      sellerId: "seller-1",
      errorCode: "UNKNOWN",
    });
    expect(JSON.stringify(mocks.logError.mock.calls)).not.toContain(sensitiveMessage);
    expect(mocks.persist).not.toHaveBeenCalled();
  });
});

function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Expected value to be defined");
  return value;
}
