import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ remove: vi.fn(), setDefault: vi.fn() }));

vi.mock("../actions/customer-address-actions", () => ({
  deleteCustomerAddressAction: mocks.remove,
  setDefaultCustomerAddressAction: mocks.setDefault,
}));

import { CustomerAddressActions } from "./customer-address-actions";

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

it("only removes the address after the customer confirms", async () => {
  mocks.remove.mockResolvedValue({ success: "Endereço removido." });
  render(<CustomerAddressActions addressId="address-1" label="Casa" isDefault />);

  fireEvent.click(screen.getByRole("button", { name: "Remover" }));
  const dialog = await screen.findByRole("alertdialog", { name: "Remover endereço?" });
  expect(dialog).toHaveTextContent("O endereço “Casa” sai da sua lista.");
  expect(mocks.remove).not.toHaveBeenCalled();

  fireEvent.click(within(dialog).getByRole("button", { name: "Remover endereço" }));
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("address-1"));
});

it("keeps the dialog open with the error when the removal fails", async () => {
  mocks.remove.mockResolvedValue({ error: "Endereço não encontrado." });
  render(<CustomerAddressActions addressId="address-1" label="Casa" isDefault />);

  fireEvent.click(screen.getByRole("button", { name: "Remover" }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Remover endereço" }));

  expect(await within(dialog).findByText("Endereço não encontrado.")).toBeInTheDocument();
});
