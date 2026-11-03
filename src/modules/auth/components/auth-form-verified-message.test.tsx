import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams("verified=1"),
}));
vi.mock("@/modules/auth/infrastructure/auth-client", () => ({
  authClient: { signIn: { email: vi.fn() }, signUp: { email: vi.fn() }, sendVerificationEmail: vi.fn() },
}));

import { AuthForm } from "./auth-form";

afterEach(cleanup);

// Regression: a verified admin (whose password is discarded, L-19) only read "Entre com sua senha" and
// then "E-mail ou senha incorretos". Everyone now sees the same hint, which reveals no admin address.
it("points to 'Esqueci minha senha' after the e-mail is confirmed, with the same text for everyone", () => {
  render(<AuthForm emailEnabled verificationRequired />);

  expect(
    screen.getByText("E-mail confirmado. Entre com sua senha. Se ela não funcionar, use 'Esqueci minha senha'."),
  ).toBeInTheDocument();
});
