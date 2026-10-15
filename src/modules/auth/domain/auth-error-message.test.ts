import { describe, expect, it } from "vitest";

import { getAuthErrorMessage, isEmailNotVerifiedError, isInvalidCredentialsError } from "./auth-error-message";

describe("getAuthErrorMessage", () => {
  it("shows the email verification guidance in Portuguese", () => {
    expect(getAuthErrorMessage("EMAIL_NOT_VERIFIED")).toMatch(/Confirme seu e-mail/);
  });

  it("does not expose provider messages in the interface", () => {
    expect(getAuthErrorMessage("UNEXPECTED_PROVIDER_ERROR")).toBe(
      "Não foi possível concluir a autenticação. Confira os dados e tente novamente.",
    );
  });

  it("explains rate limits in Portuguese for per-IP (no code) and per-account 429s", () => {
    expect(getAuthErrorMessage(undefined, 429)).toMatch(/Muitas tentativas/);
    expect(getAuthErrorMessage("TOO_MANY_REQUESTS", 429)).toMatch(/Muitas tentativas/);
  });
});

describe("isInvalidCredentialsError", () => {
  it.each([
    ["INVALID_EMAIL_OR_PASSWORD", 401, true],
    ["INVALID_CREDENTIALS", 401, true],
    ["INVALID_EMAIL_OR_PASSWORD", 429, false],
    ["EMAIL_NOT_VERIFIED", 403, false],
    [undefined, 500, false],
  ])("code %s with status %s → %s", (code, status, expected) => {
    expect(isInvalidCredentialsError(code, status)).toBe(expected);
  });
});

describe("isEmailNotVerifiedError", () => {
  it.each([
    ["EMAIL_NOT_VERIFIED", 403, true],
    ["EMAIL_NOT_VERIFIED", 429, false],
    ["INVALID_EMAIL_OR_PASSWORD", 401, false],
    [undefined, 500, false],
  ])("code %s with status %s → %s", (code, status, expected) => {
    expect(isEmailNotVerifiedError(code, status)).toBe(expected);
  });
});
