import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const sendNotificationEmail = vi.hoisted(() => vi.fn().mockResolvedValue({ status: "SENT" }));
vi.mock("server-only", () => ({}));
vi.mock("@/config/get-application-base-url", () => ({ getApplicationBaseUrl: () => "https://motoshopbrasil.com.br" }));
vi.mock("@/modules/notifications/application/send-notification-email", () => ({ sendNotificationEmail }));

import { sendAuthEmail, sendExistingAccountEmail } from "./send-auth-email";

beforeEach(() => sendNotificationEmail.mockClear());

describe("authentication email", () => {
  it("rejects a link on another origin before sending anything", async () => {
    await expect(
      sendAuthEmail({
        kind: "reset",
        to: "buyer@example.test",
        url: "https://other.example.test/reset-password?token=secret-token",
        token: "secret-token",
      }),
    ).rejects.toThrow("Invalid authentication email destination");
    expect(sendNotificationEmail).not.toHaveBeenCalled();
  });

  it("uses a token hash as the idempotency key, never the raw token", async () => {
    await sendAuthEmail({
      kind: "reset",
      to: "buyer@example.test",
      url: "https://motoshopbrasil.com.br/reset-password?token=secret-token",
      token: "secret-token",
    });
    const message = sendNotificationEmail.mock.calls[0]?.[0];
    expect(message).toMatchObject({
      kind: "AUTH_PASSWORD_RESET",
      to: "buyer@example.test",
      subject: "Redefina sua senha no Moto Shop",
    });
    expect(message.eventKey).toMatch(/^auth\.reset:[a-f0-9]{64}$/);
    expect(message.eventKey).not.toContain("secret-token");
  });

  it("distinguishes verification from password recovery", async () => {
    await sendAuthEmail({
      kind: "verify",
      to: "buyer@example.test",
      url: "https://motoshopbrasil.com.br/api/auth/verify-email?token=another-token&callbackURL=%2F",
      token: "another-token",
    });
    expect(sendNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "AUTH_EMAIL_VERIFICATION", subject: "Confirme seu e-mail no Moto Shop" }),
    );
    const message = sendNotificationEmail.mock.calls[0]?.[0];
    expect(renderToStaticMarkup(message.react)).toContain("callbackURL=%2Flogin%3Fverified%3D1");
  });

  it("warns an existing account at most once a day, keyed by an address hash", async () => {
    const now = new Date("2026-10-09T12:00:00Z");
    await sendExistingAccountEmail({ to: "Buyer@Example.test", now });
    await sendExistingAccountEmail({ to: "buyer@example.test", now });
    const [first, second] = sendNotificationEmail.mock.calls.map((call) => call[0]);
    expect(first).toMatchObject({ kind: "AUTH_EXISTING_ACCOUNT", subject: "Você já tem uma conta no Moto Shop" });
    expect(first.eventKey).toMatch(/^auth\.existing-account:[a-f0-9]{64}:2026-10-09$/);
    expect(first.eventKey).not.toContain("buyer");
    expect(second.eventKey).toBe(first.eventKey);
    const html = renderToStaticMarkup(first.react);
    expect(html).toContain("https://motoshopbrasil.com.br/login");
    expect(html).toContain("https://motoshopbrasil.com.br/forgot-password");
  });
});
