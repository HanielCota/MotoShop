import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ action: vi.fn() }));

vi.mock("../actions/customer-address-actions", () => ({ createCustomerAddressAction: mocks.action }));

import { CustomerAddressForm } from "./customer-address-form";

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

it("flags empty fields on the client and does not call the server", async () => {
  render(<CustomerAddressForm />);
  fireEvent.click(screen.getByRole("button", { name: "Salvar endereço" }));

  expect(await screen.findByText("Confira os campos destacados.")).toBeInTheDocument();
  expect(screen.getByLabelText("Nome do endereço")).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByLabelText("Nome do endereço")).toHaveAccessibleDescription("Informe um nome para o endereço.");
  expect(screen.getByLabelText("CEP")).toHaveAccessibleDescription(/Informe um CEP com 8 números\./);
  expect(screen.getByLabelText("Complemento (opcional)")).not.toHaveAttribute("aria-invalid");
  expect(mocks.action).not.toHaveBeenCalled();
});

it("clears a field error as soon as the customer edits it", async () => {
  render(<CustomerAddressForm />);
  fireEvent.click(screen.getByRole("button", { name: "Salvar endereço" }));
  await screen.findByText("Confira os campos destacados.");

  fireEvent.change(screen.getByLabelText("Nome do endereço"), { target: { value: "Casa" } });
  expect(screen.getByLabelText("Nome do endereço")).not.toHaveAttribute("aria-invalid");
});
