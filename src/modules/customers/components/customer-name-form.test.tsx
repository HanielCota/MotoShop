import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ action: vi.fn(), notify: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/modules/auth/infrastructure/auth-client", () => ({ authClient: { $store: { notify: mocks.notify } } }));
vi.mock("../actions/customer-profile-actions", () => ({ updateCustomerNameAction: mocks.action }));

import { CustomerNameForm } from "./customer-name-form";

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

it("saves the edited name and refreshes the session greeting", async () => {
  mocks.action.mockResolvedValue({ success: "Nome atualizado." });
  render(<CustomerNameForm defaultName="Luiz" />);
  fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: "Luiz Carlos" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));

  expect(await screen.findByRole("status")).toHaveTextContent("Nome atualizado.");
  expect(mocks.action).toHaveBeenCalledWith({ name: "Luiz Carlos" });
  expect(mocks.notify).toHaveBeenCalledWith("$sessionSignal");
  expect(mocks.refresh).toHaveBeenCalled();
});

it("validates the name on the client before calling the server", async () => {
  render(<CustomerNameForm defaultName="Luiz" />);
  fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: " " } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));

  expect(await screen.findByText("Informe seu nome com pelo menos 2 letras.")).toBeInTheDocument();
  expect(mocks.action).not.toHaveBeenCalled();
});

it("shows the server error", async () => {
  mocks.action.mockResolvedValue({ error: "Muitas tentativas em pouco tempo." });
  render(<CustomerNameForm defaultName="Luiz" />);
  fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Muitas tentativas em pouco tempo.");
  expect(mocks.notify).not.toHaveBeenCalled();
});
