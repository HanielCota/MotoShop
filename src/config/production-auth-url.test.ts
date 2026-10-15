import { describe, expect, it } from "vitest";

import { productionAuthUrlProblem } from "./production-auth-url";

describe("productionAuthUrlProblem (L-16)", () => {
  it("accepts the HTTPS site URL in the production deployment", () => {
    expect(productionAuthUrlProblem("https://motoshopbrasil.com.br", "production")).toBeNull();
  });

  it.each([
    [undefined, "BETTER_AUTH_URL is required in production"],
    ["", "BETTER_AUTH_URL is required in production"],
    ["http://motoshopbrasil.com.br", "BETTER_AUTH_URL must use HTTPS in production"],
    ["https://localhost:3000", "BETTER_AUTH_URL cannot be localhost in production"],
    ["not a url", "BETTER_AUTH_URL must be a valid URL"],
  ])("refuses %j in production", (url, problem) => {
    expect(productionAuthUrlProblem(url, "production")).toBe(problem);
  });

  it.each([undefined, "preview", "development"])("keeps the local fallback outside production (%s)", (vercelEnv) => {
    expect(productionAuthUrlProblem(undefined, vercelEnv)).toBeNull();
    expect(productionAuthUrlProblem("http://localhost:3000", vercelEnv)).toBeNull();
  });
});
