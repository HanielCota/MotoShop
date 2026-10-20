import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("../actions/seller-actions", () => ({ updateShippingOriginAction: mocks.update }));

import { ShippingOriginForm } from "./shipping-origin-form";

afterEach(cleanup);

const emptyStore = {
  originName: null,
  originEmail: null,
  originPhone: null,
  originDocument: null,
  originPostalCode: null,
  originStreet: null,
  originNumber: null,
  originComplement: null,
  originNeighborhood: null,
  originCity: null,
  originState: null,
  originStateRegister: null,
};

it("explains missing shipping data in Portuguese instead of the browser bubble (DN-03)", async () => {
  const { container } = render(<ShippingOriginForm store={emptyStore} />);

  expect(container.querySelector("form")).toHaveAttribute("novalidate");
  fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Informe o nome do remetente.");
  expect(mocks.update).not.toHaveBeenCalled();
});

it("formats the phone, CEP and CPF or CNPJ while typing and shows saved digits formatted", () => {
  render(<ShippingOriginForm store={{ ...emptyStore, originPostalCode: "01001000", originPhone: "11987654321" }} />);

  expect(screen.getByLabelText("CEP de origem")).toHaveValue("01001-000");
  expect(screen.getByLabelText("Telefone")).toHaveValue("(11) 98765-4321");
  fireEvent.change(screen.getByLabelText("CPF ou CNPJ"), { target: { value: "11222333000181" } });
  expect(screen.getByLabelText("CPF ou CNPJ")).toHaveValue("11.222.333/0001-81");
  fireEvent.change(screen.getByLabelText("CPF ou CNPJ"), { target: { value: "52998224725" } });
  expect(screen.getByLabelText("CPF ou CNPJ")).toHaveValue("529.982.247-25");
});

// Regression: a phone saved before the mask with the country code showed as "(55) 11987-6543".
it("shows a phone saved with the country code as it was saved instead of cutting digits", () => {
  render(<ShippingOriginForm store={{ ...emptyStore, originPhone: "+55 11 98765-4321" }} />);

  expect(screen.getByLabelText("Telefone")).toHaveValue("+55 11 98765-4321");
});
