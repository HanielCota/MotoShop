import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ signIn: vi.fn(), reset: vi.fn(), recover: vi.fn(), verify: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/modules/auth/infrastructure/auth-client", () => ({
  authClient: {
    signIn: { email: mocks.signIn },
    signUp: { email: mocks.signIn },
    resetPassword: mocks.reset,
    requestPasswordReset: mocks.recover,
    sendVerificationEmail: mocks.verify,
  },
}));
import { AuthForm } from "./auth-form";
import { PasswordRecoveryForm } from "./password-recovery-form";
import { ResetPasswordForm } from "./reset-password-form";

beforeEach(() => {
  vi.resetAllMocks();
  for (const mock of Object.values(mocks)) mock.mockRejectedValue(new Error("offline"));
});
afterEach(cleanup);

it("recovers the login button after a network rejection", async () => {
  render(<AuthForm emailEnabled verificationRequired={false} />);
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "buyer@example.test" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "test-password" } });
  fireEvent.submit(screen.getByRole("button", { name: "Entrar" }).closest("form")!);
  expect(await screen.findByRole("alert")).toHaveTextContent("conexão");
  expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
});
it("shows a localized inline validation error without submitting an empty login", async () => {
  render(<AuthForm emailEnabled verificationRequired={false} />);
  fireEvent.submit(screen.getByRole("button", { name: "Entrar" }).closest("form")!);
  expect(await screen.findByRole("alert")).toHaveTextContent("Informe um e-mail válido.");
  expect(mocks.signIn).not.toHaveBeenCalled();
});
it("recovers the password recovery form after network rejection", async () => {
  render(<PasswordRecoveryForm />);
  fireEvent.change(screen.getByLabelText("E-mail da conta"), { target: { value: "buyer@example.test" } });
  fireEvent.submit(screen.getByRole("button", { name: "Enviar link de recuperação" }).closest("form")!);
  expect(await screen.findByRole("alert")).toHaveTextContent("conexão");
  expect(screen.getByRole("button", { name: "Enviar link de recuperação" })).toBeEnabled();
});
it("does not display success after a failed password reset", async () => {
  render(<ResetPasswordForm token="test-only-token" />);
  fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "new-password" } });
  fireEvent.change(screen.getByLabelText("Confirme a nova senha"), { target: { value: "new-password" } });
  fireEvent.submit(screen.getByRole("button", { name: "Salvar nova senha" }).closest("form")!);
  expect(await screen.findByRole("alert")).toHaveTextContent("conexão");
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByRole("button", { name: "Salvar nova senha" })).toBeEnabled();
});
