import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resolve: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/config/env", () => ({ env: { NODE_ENV: "production" } }));
vi.mock("@/config/get-application-base-url", () => ({ getApplicationBaseUrl: () => "https://motoshop.example" }));
vi.mock("@/modules/orders/application/resolve-customer-order-access", () => ({
  resolveCustomerOrderIdentity: mocks.resolve,
}));

import { NextRequest } from "next/server";

import { GET } from "./route";

const token = "a".repeat(64);

function access(query: string) {
  return GET(new NextRequest(`https://motoshop.example/orders/MS-1/access?${query}`), {
    params: Promise.resolve({ orderNumber: "MS-1" }),
  });
}

describe("GET /orders/[orderNumber]/access", () => {
  beforeEach(() => mocks.resolve.mockReset());

  it("swaps a valid guest token for an HttpOnly cookie scoped to the order and drops it from the URL", async () => {
    mocks.resolve.mockResolvedValue({ guestAccessTokenHash: "hash" });

    const response = await access(`token=${token}`);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://motoshop.example/orders/MS-1");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`ms_guest_order=${token}`);
    expect(cookie).toContain("Path=/orders/MS-1");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(mocks.resolve).toHaveBeenCalledWith({ orderNumber: "MS-1", accessToken: token });
  });

  it("sets nothing for an invalid or expired token", async () => {
    mocks.resolve.mockResolvedValue(null);

    const response = await access(`token=${token}`);

    expect(response.headers.get("location")).toBe("https://motoshop.example/orders/MS-1");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("ignores a signed-in owner match: only a guest token becomes the cookie", async () => {
    mocks.resolve.mockResolvedValue({ userId: "user-1" });

    expect((await access(`token=${token}`)).headers.get("set-cookie")).toBeNull();
  });

  it("does not look up anything for a missing or malformed token", async () => {
    expect((await access("")).headers.get("set-cookie")).toBeNull();
    expect((await access("token=short")).headers.get("set-cookie")).toBeNull();
    expect(mocks.resolve).not.toHaveBeenCalled();
  });
});
