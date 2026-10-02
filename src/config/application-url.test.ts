import { describe, expect, it } from "vitest";

import { resolveApplicationBaseUrl } from "./application-url";

describe("resolveApplicationBaseUrl", () => {
  it("uses Vercel's unique host for each Preview deployment", () => {
    expect(
      resolveApplicationBaseUrl({
        configuredUrl: "http://localhost:3000",
        deploymentEnvironment: "preview",
        deploymentUrl: "moto-shop-brasil-abc123.vercel.app",
      }),
    ).toBe("https://moto-shop-brasil-abc123.vercel.app");
  });

  it("prefers an explicitly configured stable Preview domain", () => {
    expect(
      resolveApplicationBaseUrl({
        configuredUrl: "https://preview.motoshopbrasil.com.br",
        deploymentEnvironment: "preview",
        deploymentUrl: "moto-shop-brasil-abc123.vercel.app",
      }),
    ).toBe("https://preview.motoshopbrasil.com.br");
  });

  it("keeps the configured canonical URL in Production and local development", () => {
    expect(
      resolveApplicationBaseUrl({
        configuredUrl: "https://motoshopbrasil.com.br/path/",
        deploymentEnvironment: "production",
        deploymentUrl: "moto-shop-brasil-abc123.vercel.app",
      }),
    ).toBe("https://motoshopbrasil.com.br");
    expect(resolveApplicationBaseUrl({ configuredUrl: "http://localhost:3000" })).toBe("http://localhost:3000");
  });

  it("fails clearly when Preview has no deployment host", () => {
    expect(() =>
      resolveApplicationBaseUrl({ configuredUrl: "http://localhost:3000", deploymentEnvironment: "preview" }),
    ).toThrow("VERCEL_URL is required for a Preview deployment.");
  });

  it("rejects a URL or path where only a deployment hostname is expected", () => {
    expect(() =>
      resolveApplicationBaseUrl({
        configuredUrl: "http://localhost:3000",
        deploymentEnvironment: "preview",
        deploymentUrl: "https://moto-shop-brasil.vercel.app/path",
      }),
    ).toThrow("VERCEL_URL must contain only the Preview deployment hostname.");
  });
});
