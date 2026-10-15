import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), resend: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/modules/auth/infrastructure/auth-client", () => ({
  authClient: { signIn: { email: mocks.signIn }, signUp: { email: mocks.signIn }, sendVerificationEmail: mocks.resend },
}));

import { AuthForm } from "./auth-form";

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

async function submitWrongPassword(emailEnabled: boolean) {
  render(<AuthForm emailEnabled={emailEnabled} verificationRequired={false} />);
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "buyer@example.test" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "wrong-password" } });
  const form = screen.getByRole("button", { name: "Entrar" }).closest("form");
  if (!form) throw new Error("Expected the login form");
  fireEvent.submit(form);
  expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha incorretos.");
}

it("offers password recovery and sign-up next to a wrong-password error", async () => {
  mocks.signIn.mockResolvedValue({ error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 } });

  await submitWrongPassword(true);

  expect(screen.getByText("Não consegue entrar?")).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: "Esqueci minha senha" })).toHaveLength(1);
  expect(screen.getByRole("link", { name: "Esqueci minha senha" })).toHaveAttribute("href", "/forgot-password");

  fireEvent.click(screen.getByRole("button", { name: /Ainda não tenho conta\?\s*Criar conta/ }));
  expect(screen.getByRole("heading", { name: "Crie sua conta" })).toBeInTheDocument();
  expect(screen.queryByText("Não consegue entrar?")).not.toBeInTheDocument();
});

it("hides password recovery when e-mail sending is not configured", async () => {
  mocks.signIn.mockResolvedValue({ error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 } });

  await submitWrongPassword(false);

  expect(screen.queryByRole("link", { name: "Esqueci minha senha" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Criar conta/ })).toBeInTheDocument();
});

it("keeps the help hidden for other sign-in errors", async () => {
  mocks.signIn.mockResolvedValue({ error: { code: "TOO_MANY_REQUESTS", status: 429 } });
  render(<AuthForm emailEnabled verificationRequired={false} />);
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "buyer@example.test" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "wrong-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Muitas tentativas");
  expect(screen.queryByText("Não consegue entrar?")).not.toBeInTheDocument();
});

it("does not offer to resend the confirmation before a sign-in error, nor after a wrong password", async () => {
  mocks.signIn.mockResolvedValue({ error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 } });
  render(<AuthForm emailEnabled verificationRequired />);
  expect(screen.queryByRole("button", { name: "Reenviar confirmação" })).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "unknown@example.test" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "wrong-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha incorretos.");
  expect(screen.queryByRole("button", { name: "Reenviar confirmação" })).not.toBeInTheDocument();
});

it("offers the resend only after EMAIL_NOT_VERIFIED and sends it to that sign-in e-mail", async () => {
  mocks.signIn.mockResolvedValue({ error: { code: "EMAIL_NOT_VERIFIED", status: 403 } });
  mocks.resend.mockResolvedValue({ data: { status: true } });
  render(<AuthForm emailEnabled verificationRequired />);
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "rider@example.test" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "right-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

  const resend = await screen.findByRole("button", { name: "Reenviar confirmação" });
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "someone-else@example.test" } });
  fireEvent.click(resend);

  expect(await screen.findByRole("status")).toHaveTextContent("enviaremos um novo link");
  expect(mocks.resend).toHaveBeenCalledWith({ email: "rider@example.test", callbackURL: "/login?verified=1" });
});

it("hints the password length only when creating an account", () => {
  render(<AuthForm emailEnabled verificationRequired={false} />);
  expect(screen.getByLabelText("Senha")).not.toHaveAttribute("placeholder");

  fireEvent.click(screen.getByRole("button", { name: "Ainda não tenho conta" }));
  expect(screen.getByLabelText("Senha")).toHaveAttribute("placeholder", "Pelo menos 8 caracteres");
});
