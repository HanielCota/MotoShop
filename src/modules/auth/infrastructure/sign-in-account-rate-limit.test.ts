import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const consume = vi.hoisted(() => vi.fn());
vi.mock("@/shared/rate-limit/consume-rate-limit", () => ({ consumeRateLimit: consume }));

import { enforceSignInAccountRateLimit } from "./sign-in-account-rate-limit";

beforeEach(() => {
  consume.mockReset();
  consume.mockResolvedValue({ allowed: true, retryAfter: null });
});

it("limits sign-in attempts per normalized e-mail over 15 minutes", async () => {
  await enforceSignInAccountRateLimit("/sign-in/email", { email: "  Rider@Example.TEST ", password: "x" });
  expect(consume).toHaveBeenCalledWith({
    key: "auth:sign-in-account:rider@example.test",
    windowSeconds: 900,
    max: 10,
  });
});

it("rejects with a 429 once the account limit is exhausted", async () => {
  consume.mockResolvedValue({ allowed: false, retryAfter: 120 });
  await expect(enforceSignInAccountRateLimit("/sign-in/email", { email: "rider@example.test" })).rejects.toMatchObject({
    statusCode: 429,
    body: expect.objectContaining({ code: "TOO_MANY_REQUESTS" }),
  });
});

it("ignores other endpoints and bodies without an e-mail", async () => {
  await enforceSignInAccountRateLimit("/sign-up/email", { email: "rider@example.test" });
  await enforceSignInAccountRateLimit("/sign-in/email", { email: 42 });
  await enforceSignInAccountRateLimit("/sign-in/email", undefined);
  expect(consume).not.toHaveBeenCalled();
});
