import { expect, it } from "vitest";
import { betterAuth } from "better-auth/minimal";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuthMiddleware } from "better-auth/api";
import { withoutSessionToken } from "./session-response";

it("removes session.token from /api/auth/get-session through the real auth dispatch (M-03)", async () => {
  const db: Record<string, unknown[]> = { user: [], session: [], account: [], verification: [] };
  const auth = betterAuth({
    secret: "probe-secret-with-at-least-32-characters!!",
    baseURL: "http://localhost:3000",
    database: memoryAdapter(db),
    emailAndPassword: { enabled: true },
    hooks: { after: createAuthMiddleware(async (ctx) => withoutSessionToken(ctx.path, ctx.context.returned)) },
  });
  const signUp = await auth.api.signUpEmail({
    body: { email: "probe@example.test", password: "probe-password-1", name: "Probe" },
    returnHeaders: true,
  });
  const cookie = signUp.headers.get("set-cookie") ?? "";
  const response = await auth.handler(
    new Request("http://localhost:3000/api/auth/get-session", { headers: { cookie: cookie.split(";")[0] ?? "" } }),
  );
  const body = await response.json();
  expect(body.session.id).toBeTruthy();
  expect(body.session.token).toBeUndefined();
});
