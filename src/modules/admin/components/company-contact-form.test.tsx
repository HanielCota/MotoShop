import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ update: vi.fn(), refresh: vi.fn() }));
vi.mock("../actions/marketplace-configuration-actions", () => ({ updateCompanyContactAction: mocks.update }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { resolveCompanyContact } from "../domain/company-contact";
import { companyContactFormValues } from "../schemas/company-contact";
import { CompanyContactForm } from "./company-contact-form";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

function renderForm() {
  return render(<CompanyContactForm defaultValues={companyContactFormValues(resolveCompanyContact(null))} />);
}

it("opens with the texts the footers show today, CNPJ masked", () => {
  renderForm();

  expect(screen.getByLabelText("Razão social")).toHaveValue("MOTO SHOP BRASIL E-COMMERCE E MARKETPLACE");
  expect(screen.getByLabelText("CNPJ")).toHaveValue("69.663.409/0001-94");
  expect(screen.getByLabelText("E-mail de atendimento")).toHaveValue("");
});

it("masks the phone while typing and sends the typed fields for the server to validate again", async () => {
  mocks.update.mockResolvedValue({ success: "Empresa e contato atualizados." });
  renderForm();

  fireEvent.change(screen.getByLabelText("Telefone ou WhatsApp"), { target: { value: "11912345678" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar empresa e contato" }));

  await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  expect(screen.getByLabelText("Telefone ou WhatsApp")).toHaveValue("(11) 91234-5678");
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ supportPhone: "(11) 91234-5678" }));
});

it("points to the wrong field in Portuguese without calling the server", async () => {
  renderForm();

  fireEvent.change(screen.getByLabelText("E-mail de atendimento"), { target: { value: "atendimento@" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar empresa e contato" }));

  expect(await screen.findByText("Informe um e-mail válido.")).toBeInTheDocument();
  expect(screen.getByLabelText("E-mail de atendimento")).toHaveAttribute("aria-invalid", "true");
  expect(mocks.update).not.toHaveBeenCalled();
});
