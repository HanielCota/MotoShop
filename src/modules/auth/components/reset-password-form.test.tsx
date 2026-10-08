import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resetPassword: vi.fn() }));
vi.mock("@/modules/auth/infrastructure/auth-client", () => ({
  authClient: { resetPassword: mocks.resetPassword },
}));

import { ResetPasswordForm } from "./reset-password-form";

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

afterEach(cleanup);

beforeEach(() => {
  mocks.resetPassword.mockReset();
});

describe("ResetPasswordForm", () => {
  it("shows field errors without calling the server", async () => {
    render(<ResetPasswordForm token="token-1" />);
    fill(/^Nova senha/, "curta");
    fill(/^Confirme a nova senha/, "outra");
    fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByText(/pelo menos 8 caracteres\./)).toBeInTheDocument();
    expect(screen.getByText("As senhas não coincidem.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Nova senha/)).toHaveAttribute("aria-invalid", "true");
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  it("resets the password with the token and confirms success", async () => {
    mocks.resetPassword.mockResolvedValue({ error: null });
    render(<ResetPasswordForm token="token-1" />);
    fill(/^Nova senha/, "senha-forte-123");
    fill(/^Confirme a nova senha/, "senha-forte-123");
    fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    await waitFor(() =>
      expect(mocks.resetPassword).toHaveBeenCalledWith({ newPassword: "senha-forte-123", token: "token-1" }),
    );
    expect(await screen.findByText(/Senha atualizada/)).toBeInTheDocument();
  });

  it("explains an expired link", async () => {
    mocks.resetPassword.mockResolvedValue({ error: { code: "INVALID_TOKEN" } });
    render(<ResetPasswordForm token="token-1" />);
    fill(/^Nova senha/, "senha-forte-123");
    fill(/^Confirme a nova senha/, "senha-forte-123");
    fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByText(/link expirou ou já foi utilizado/)).toBeInTheDocument();
  });
});
