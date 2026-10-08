import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const requestPasswordReset = vi.hoisted(() => vi.fn());

vi.mock("@/modules/auth/infrastructure/auth-client", () => ({
  authClient: { requestPasswordReset },
}));

import { PasswordRecoveryForm } from "./password-recovery-form";

beforeEach(() => requestPasswordReset.mockReset());
afterEach(cleanup);

it("shows a Portuguese validation message instead of browser default UI for an empty email", () => {
  render(<PasswordRecoveryForm />);
  fireEvent.click(screen.getByRole("button", { name: "Enviar link de recuperação" }));

  expect(screen.getByRole("alert").textContent).toBe("Informe um e-mail válido.");
  expect(requestPasswordReset).not.toHaveBeenCalled();
});

it("does not send a malformed email", () => {
  render(<PasswordRecoveryForm />);
  fireEvent.change(screen.getByRole("textbox", { name: "E-mail da conta" }), { target: { value: "invalid" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar link de recuperação" }));

  expect(screen.getByRole("alert").textContent).toBe("Informe um e-mail válido.");
  expect(requestPasswordReset).not.toHaveBeenCalled();
});
