import { describe, expect, it } from "vitest";

import { getAuthErrorMessage } from "./auth-error-message";

describe("getAuthErrorMessage", () => {
  it("shows the email verification guidance in Portuguese", () => {
    expect(getAuthErrorMessage("EMAIL_NOT_VERIFIED")).toMatch(/Confirme seu e-mail/);
  });

  it("does not expose provider messages in the interface", () => {
    expect(getAuthErrorMessage("UNEXPECTED_PROVIDER_ERROR")).toBe(
      "Não foi possível concluir a autenticação. Confira os dados e tente novamente.",
    );
  });
});
