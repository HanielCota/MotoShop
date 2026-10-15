import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/config/env", () => ({ env: { BETTER_AUTH_SECRET: "test-secret-with-enough-length-0123456789" } }));

import { createGuestOrderLinkToken, isGuestOrderLinkToken } from "./guest-order-link-token";

describe("guest order e-mail link token", () => {
  it("is stable per order and differs between orders", () => {
    const token = createGuestOrderLinkToken("order-1");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(createGuestOrderLinkToken("order-1")).toBe(token);
    expect(createGuestOrderLinkToken("order-2")).not.toBe(token);
  });

  it("accepts only the token of that order", () => {
    const token = createGuestOrderLinkToken("order-1");
    expect(isGuestOrderLinkToken("order-1", token)).toBe(true);
    expect(isGuestOrderLinkToken("order-2", token)).toBe(false);
    expect(isGuestOrderLinkToken("order-1", "short")).toBe(false);
  });
});
