import { getRedirectUrl, unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "./proxy";

const origin = "https://motoshop.example";

describe("seller login proxy", () => {
  it("sends a visitor to the login with the seller page they asked for, query included", () => {
    const response = proxy(new NextRequest(`${origin}/seller/orders?status=PAID`));

    expect(response.status).toBe(307);
    expect(getRedirectUrl(response)).toBe(`${origin}/login?next=%2Fseller%2Forders%3Fstatus%3DPAID`);
  });

  it("lets a request with a session cookie through, for the server to check", () => {
    const request = new NextRequest(`${origin}/seller/orders`, {
      headers: { cookie: "better-auth.session_token=abc.def" },
    });

    expect(getRedirectUrl(proxy(request))).toBeNull();
  });

  it("lets a Server Function POST through, for the action's own session check to answer", () => {
    const request = new NextRequest(`${origin}/seller/settings`, {
      method: "POST",
      headers: { "next-action": "abc123" },
    });

    expect(getRedirectUrl(proxy(request))).toBeNull();
  });

  it("runs only on the internal seller pages, not on /seller itself nor on other areas", () => {
    const runsOn = (url: string) => unstable_doesMiddlewareMatch({ config, url });

    expect(runsOn("/seller/orders")).toBe(true);
    expect(runsOn("/seller/products/new")).toBe(true);
    expect(runsOn("/seller")).toBe(false);
    expect(runsOn("/admin/orders")).toBe(false);
    expect(runsOn("/products")).toBe(false);
    expect(runsOn("/")).toBe(false);
  });
});
