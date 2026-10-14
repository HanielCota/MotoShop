import { describe, expect, it } from "vitest";

import { getClientIp } from "./client-ip";

const headersOf = (entries: Record<string, string>) => new Headers(entries);

describe("getClientIp (L-05)", () => {
  it("uses the platform header set by Vercel", () => {
    expect(getClientIp(headersOf({ "x-vercel-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
    expect(getClientIp(headersOf({ "x-vercel-forwarded-for": "2001:DB8::1" }))).toBe("2001:db8::1");
  });

  it("ignores the client-controlled x-forwarded-for and x-real-ip", () => {
    expect(getClientIp(headersOf({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "5.6.7.8" }))).toBe("unknown");
  });

  it.each(["1.2.3.4, 5.6.7.8", "not-an-ip", "999.1.1.1", ""])("refuses %j as a trusted value", (value) => {
    expect(getClientIp(headersOf({ "x-vercel-forwarded-for": value }))).toBe("unknown");
  });
});
