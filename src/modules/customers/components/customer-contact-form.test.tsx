import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../actions/customer-profile-actions", () => ({ updateCustomerContactAction: mocks.update }));

import { customerContactSchema } from "../schemas/customer-account";
import { CustomerContactForm } from "./customer-contact-form";

beforeEach(() => {
  vi.resetAllMocks();
  // Behave like the real action: validate what the form sends with the same schema.
  mocks.update.mockImplementation(async (input: unknown) => {
    const parsed = customerContactSchema.safeParse(input);
    return parsed.success ? { success: "Dados atualizados." } : { error: parsed.error.issues[0]?.message };
  });
});
afterEach(cleanup);

async function save(values: { taxId?: string; phone?: string }) {
  render(<CustomerContactForm taxId={null} phone={null} />);
  if (values.taxId)
    fireEvent.change(screen.getByLabelText("CPF ou CNPJ (opcional)"), { target: { value: values.taxId } });
  if (values.phone)
    fireEvent.change(screen.getByLabelText("Telefone com DDD (opcional)"), { target: { value: values.phone } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar dados" }));
  return screen.findByText(/Dados atualizados\.|Informe|Confira/);
}

it.each([
  [{ phone: "11987654321" }, { taxId: null, phone: "11987654321" }],
  [{ taxId: "52998224725" }, { taxId: "52998224725", phone: null }],
  [{}, { taxId: null, phone: null }],
  [
    { taxId: "52998224725", phone: "11987654321" },
    { taxId: "52998224725", phone: "11987654321" },
  ],
])("saves %j on the first save without an English validation message", async (values, sent) => {
  expect(await save(values)).toHaveTextContent("Dados atualizados.");
  expect(mocks.update).toHaveBeenCalledWith(sent);
  expect(screen.queryByText(/Invalid input|expected/)).not.toBeInTheDocument();
});
