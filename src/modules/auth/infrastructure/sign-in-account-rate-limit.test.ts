import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ consume: vi.fn(), peek: vi.fn(), clear: vi.fn() }));
vi.mock("@/shared/rate-limit/consume-rate-limit", () => ({
  consumeRateLimit: mocks.consume,
  peekRateLimit: mocks.peek,
  clearRateLimit: mocks.clear,
}));

import { assertSignInAccountNotLocked, recordSignInAccountOutcome } from "./sign-in-account-rate-limit";

const key = "auth:sign-in-account:rider@example.test";
const wrongPassword = new APIError("UNAUTHORIZED", { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid" });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.peek.mockResolvedValue({ blocked: false, retryAfter: null });
});

describe("assertSignInAccountNotLocked (M-01)", () => {
  it("only reads the counter before the password check, with a normalized e-mail", async () => {
    await assertSignInAccountNotLocked("/sign-in/email", { email: "  Rider@Example.TEST ", password: "x" });

    expect(mocks.peek).toHaveBeenCalledWith({ key, max: 10 });
    expect(mocks.consume).not.toHaveBeenCalled();
  });

  it("answers 429 once the account reached the failure limit", async () => {
    mocks.peek.mockResolvedValue({ blocked: true, retryAfter: 120 });

    await expect(assertSignInAccountNotLocked("/sign-in/email", { email: "rider@example.test" })).rejects.toMatchObject(
      {
        statusCode: 429,
      },
    );
  });

  it("ignores other routes and malformed bodies", async () => {
    await assertSignInAccountNotLocked("/sign-up/email", { email: "rider@example.test" });
    await assertSignInAccountNotLocked("/sign-in/email", { email: 42 });
    await assertSignInAccountNotLocked("/sign-in/email", undefined);

    expect(mocks.peek).not.toHaveBeenCalled();
  });
});

describe("recordSignInAccountOutcome (M-01)", () => {
  it("counts a wrong e-mail or password", async () => {
    await recordSignInAccountOutcome("/sign-in/email", { email: "rider@example.test" }, wrongPassword);

    expect(mocks.consume).toHaveBeenCalledWith({ key, windowSeconds: 900, max: 10 });
    expect(mocks.clear).not.toHaveBeenCalled();
  });

  it("clears the failures after a successful sign-in", async () => {
    await recordSignInAccountOutcome("/sign-in/email", { email: "rider@example.test" }, { token: "t", user: {} });

    expect(mocks.clear).toHaveBeenCalledWith(key);
    expect(mocks.consume).not.toHaveBeenCalled();
  });

  it("does not count rate-limited or unverified attempts as wrong passwords", async () => {
    const tooMany = new APIError("TOO_MANY_REQUESTS", { code: "TOO_MANY_REQUESTS", message: "x" });
    const unverified = new APIError("FORBIDDEN", { code: "EMAIL_NOT_VERIFIED", message: "x" });

    await recordSignInAccountOutcome("/sign-in/email", { email: "rider@example.test" }, tooMany);
    await recordSignInAccountOutcome("/sign-in/email", { email: "rider@example.test" }, unverified);

    expect(mocks.consume).not.toHaveBeenCalled();
    expect(mocks.clear).not.toHaveBeenCalled();
  });

  it("ignores other routes", async () => {
    await recordSignInAccountOutcome("/sign-up/email", { email: "rider@example.test" }, wrongPassword);

    expect(mocks.consume).not.toHaveBeenCalled();
  });
});
