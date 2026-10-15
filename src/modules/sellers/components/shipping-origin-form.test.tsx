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
