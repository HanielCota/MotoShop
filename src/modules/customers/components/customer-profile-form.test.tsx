import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updateName: vi.fn(), updateContact: vi.fn(), notify: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/modules/auth/infrastructure/auth-client", () => ({ authClient: { $store: { notify: mocks.notify } } }));
vi.mock("../actions/customer-profile-actions", () => ({
  updateCustomerNameAction: mocks.updateName,
  updateCustomerContactAction: mocks.updateContact,
}));

import { customerContactSchema } from "../schemas/customer-account";
import { CustomerProfileForm } from "./customer-profile-form";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.updateName.mockResolvedValue({ success: "Nome atualizado." });
  // Behave like the real action: validate what the form sends with the same schema.
  mocks.updateContact.mockImplementation(async (input: unknown) => {
    const parsed = customerContactSchema.safeParse(input);
    return parsed.success ? { success: "Dados atualizados." } : { error: parsed.error.issues[0]?.message };
  });
});
afterEach(cleanup);

function renderForm() {
  render(<CustomerProfileForm defaultName="Luiz" taxId={null} phone={null} />);
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
}

it("saves name and phone edited together with a single button", async () => {
  renderForm();
  expect(screen.getAllByRole("button")).toHaveLength(1);

  fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: "Luiz Carlos" } });
  fireEvent.change(screen.getByLabelText("Telefone com DDD (opcional)"), { target: { value: "11987654321" } });
  save();

  expect(await screen.findByRole("status")).toHaveTextContent("Dados atualizados.");
  expect(mocks.updateName).toHaveBeenCalledWith({ name: "Luiz Carlos" });
  expect(mocks.updateContact).toHaveBeenCalledWith({ taxId: null, phone: "11987654321" });
  expect(mocks.notify).toHaveBeenCalledWith("$sessionSignal");
  expect(mocks.refresh).toHaveBeenCalled();
});

it("leaves the name alone when only the contact changed", async () => {
  renderForm();
  fireEvent.change(screen.getByLabelText("CPF ou CNPJ (opcional)"), { target: { value: "52998224725" } });
  save();

  expect(await screen.findByRole("status")).toHaveTextContent("Dados atualizados.");
  expect(mocks.updateName).not.toHaveBeenCalled();
  expect(mocks.updateContact).toHaveBeenCalledWith({ taxId: "52998224725", phone: null });
});

it("validates on the client before calling the server", async () => {
  renderForm();
  fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: " " } });
  save();

  expect(await screen.findByText("Informe seu nome com pelo menos 2 letras.")).toBeInTheDocument();
  expect(mocks.updateName).not.toHaveBeenCalled();
  expect(mocks.updateContact).not.toHaveBeenCalled();
});

it("stops and shows the error when the name cannot be saved", async () => {
  mocks.updateName.mockResolvedValue({ error: "Não foi possível salvar seu nome agora." });
  renderForm();
  fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: "Luiz Carlos" } });
  save();

  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível salvar seu nome agora.");
  expect(mocks.updateContact).not.toHaveBeenCalled();
});
