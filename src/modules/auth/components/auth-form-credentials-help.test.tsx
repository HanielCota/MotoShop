import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/modules/auth/infrastructure/auth-client", () => ({
  authClient: { signIn: { email: mocks.signIn }, signUp: { email: mocks.signIn } },
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
