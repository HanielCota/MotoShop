import { describe, expect, it } from "vitest";

import { scrubSentryBreadcrumb, scrubSentryEvent, scrubUrl } from "./sentry-privacy";

describe("scrubUrl (M-02)", () => {
  it.each([
    ["/orders/MS-1?accessToken=abc123", "/orders/MS-1?accessToken=%5BFiltered%5D"],
    [
      "https://motoshopbrasil.com.br/reset-password?token=t0k3n&x=1",
      "https://motoshopbrasil.com.br/reset-password?token=%5BFiltered%5D&x=1",
    ],
    ["/api/shipping/callback?code=oauth&state=s", "/api/shipping/callback?code=%5BFiltered%5D&state=%5BFiltered%5D"],
    ["/products?q=capacete#reviews", "/products?q=capacete#reviews"],
    ["/products", "/products"],
  ])("%s → %s", (url, expected) => {
    expect(scrubUrl(url)).toBe(expected);
  });
});

describe("scrubSentryEvent (M-02)", () => {
  it("filters secrets from the request, breadcrumbs, spans and trace data", () => {
    const event = scrubSentryEvent({
      request: {
        url: "https://site/orders/MS-1?accessToken=abc",
        query_string: "accessToken=abc&page=2",
        headers: { Cookie: "session=1", Authorization: "Bearer x", "User-Agent": "test" },
        cookies: { session: "1" },
      },
      breadcrumbs: [{ data: { from: "/checkout", to: "/orders/MS-1?accessToken=abc" } }],
      spans: [{ data: { "http.url": "https://site/reset-password?token=t" } }],
      contexts: { trace: { data: { "url.full": "https://site/orders/MS-1?accessToken=abc" } } },
    });

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain("abc");
    expect(serialized).not.toContain("token=t");
    expect(serialized).not.toContain("session=1");
    expect(serialized).not.toContain("Bearer");
    expect(event.request?.query_string).toBe("accessToken=%5BFiltered%5D&page=2");
    expect(event.request?.headers).toEqual({ "User-Agent": "test" });
  });

  it("leaves events without a request untouched", () => {
    expect(scrubSentryEvent({})).toEqual({});
  });
});

it("filters navigation breadcrumbs (M-02)", () => {
  expect(scrubSentryBreadcrumb({ data: { to: "/orders/MS-1?accessToken=abc" } })).toEqual({
    data: { to: "/orders/MS-1?accessToken=%5BFiltered%5D" },
  });
});
