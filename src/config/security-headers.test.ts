import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy, buildSecurityHeaders } from "./security-headers";

const header = (headers: { key: string; value: string }[], key: string) => headers.find((entry) => entry.key === key);

describe("security headers", () => {
  it("enforces the baseline headers and keeps the CSP report-only", () => {
    const headers = buildSecurityHeaders({ development: false });
    expect(header(headers, "X-Content-Type-Options")?.value).toBe("nosniff");
    expect(header(headers, "X-Frame-Options")?.value).toBe("DENY");
    expect(header(headers, "Strict-Transport-Security")).toBeDefined();
    expect(header(headers, "Content-Security-Policy")).toBeUndefined();
    expect(header(headers, "Content-Security-Policy-Report-Only")).toBeDefined();
  });

  it("allows the third parties the checkout depends on", () => {
    const policy = buildContentSecurityPolicy({ development: false });
    expect(policy).toContain("script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com");
    expect(policy).toContain("https://viacep.com.br");
    expect(policy).toContain("https://upload.imagekit.io");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it("relaxes only what the dev server needs", () => {
    const policy = buildContentSecurityPolicy({ development: true });
    expect(policy).toContain("'unsafe-eval'");
    expect(header(buildSecurityHeaders({ development: true }), "Strict-Transport-Security")).toBeUndefined();
  });
});
