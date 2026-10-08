import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const changePassword = vi.hoisted(() => vi.fn());

vi.mock("@/modules/auth/infrastructure/auth-client", () => ({ authClient: { changePassword } }));

import { ChangePasswordForm } from "./change-password-form";

beforeEach(() => changePassword.mockReset());
afterEach(cleanup);

function fill({
  current = "senha-antiga",
  next = "senha-nova-123",
  confirmation,
}: { current?: string; next?: string; confirmation?: string } = {}) {
  confirmation ??= next;
  fireEvent.change(screen.getByLabelText(/Senha atual/), { target: { value: current } });
  fireEvent.change(screen.getByLabelText(/^Nova senha/), { target: { value: next } });
  fireEvent.change(screen.getByLabelText(/Confirme a nova senha/), { target: { value: confirmation } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
}

it("changes the password and revokes the other sessions", async () => {
  changePassword.mockResolvedValue({ data: { token: "t" }, error: null });
  render(<ChangePasswordForm />);
  fill();

  expect(await screen.findByRole("status")).toHaveTextContent("Senha alterada.");
  expect(changePassword).toHaveBeenCalledWith({
    currentPassword: "senha-antiga",
    newPassword: "senha-nova-123",
    revokeOtherSessions: true,
  });
  expect(screen.getByLabelText(/Senha atual/)).toHaveValue("");
});

it("requires at least 8 characters before calling Better Auth", async () => {
  render(<ChangePasswordForm />);
  fill({ next: "curta" });

  expect(await screen.findByText("A nova senha precisa ter pelo menos 8 caracteres.")).toBeInTheDocument();
  expect(changePassword).not.toHaveBeenCalled();
});

it("requires the confirmation to match", async () => {
  render(<ChangePasswordForm />);
  fill({ confirmation: "outra-senha-123" });

  expect(await screen.findByText("As senhas não coincidem.")).toBeInTheDocument();
  expect(screen.getByLabelText(/Confirme a nova senha/)).toHaveAttribute("aria-invalid", "true");
  expect(changePassword).not.toHaveBeenCalled();
});

it("explains a wrong current password next to the field", async () => {
  changePassword.mockResolvedValue({ data: null, error: { code: "INVALID_PASSWORD", status: 400 } });
  render(<ChangePasswordForm />);
  fill();

  expect(await screen.findByRole("alert")).toHaveTextContent("A senha atual está incorreta.");
  await waitFor(() => expect(screen.getByLabelText(/Senha atual/)).toHaveAttribute("aria-invalid", "true"));
});

it("explains rate limiting and network failures", async () => {
  changePassword.mockResolvedValueOnce({ data: null, error: { status: 429 } });
  render(<ChangePasswordForm />);
  fill();
  expect(await screen.findByRole("alert")).toHaveTextContent("Muitas tentativas");

  changePassword.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar");
});

it("links to password recovery for customers who forgot the current password", () => {
  render(<ChangePasswordForm />);
  expect(screen.getByRole("link", { name: "Esqueci minha senha atual" })).toHaveAttribute("href", "/forgot-password");
});
