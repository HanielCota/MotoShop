import { describe, expect, it } from "vitest";

import { withoutSessionToken } from "./session-response";

const sessionResponse = {
  session: { id: "s1", userId: "u1", token: "secret-session-token", expiresAt: "2026-10-21" },
  user: { id: "u1", email: "rider@example.test" },
};

describe("withoutSessionToken (M-03)", () => {
  it("removes the token from /get-session and keeps the rest", () => {
    const result = withoutSessionToken("/get-session", sessionResponse);

    expect(result).toEqual({
      session: { id: "s1", userId: "u1", expiresAt: "2026-10-21" },
      user: { id: "u1", email: "rider@example.test" },
    });
    expect(JSON.stringify(result)).not.toContain("secret-session-token");
    expect(sessionResponse.session.token).toBe("secret-session-token");
  });

  it.each([
    ["/sign-in/email", sessionResponse],
    ["/get-session", null],
    ["/get-session", { session: null, user: null }],
    ["/get-session", { session: { id: "s1" } }],
  ])("leaves %s responses untouched (%j)", (path, returned) => {
    expect(withoutSessionToken(path, returned)).toBeUndefined();
  });
});
