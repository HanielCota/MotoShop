import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ adjust: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/modules/products/actions/product-actions", () => ({ adjustInventoryAction: mocks.adjust }));

import { InventoryAdjustDialog } from "./inventory-adjust-dialog";

const variants = [{ id: "cvariant0001", title: "Preto · G", sku: "CAP-G", availableQuantity: 2 }];

beforeEach(() => mocks.adjust.mockReset());
afterEach(cleanup);

function openDialog() {
  render(<InventoryAdjustDialog productName="Capacete Apex Pro" variants={variants} />);
  fireEvent.click(screen.getByRole("button", { name: "Ajustar estoque" }));
}

it("does not send an empty adjustment to the server (BUG-011)", async () => {
  openDialog();

  fireEvent.click(await screen.findByRole("button", { name: "Salvar ajuste" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Informe uma quantidade em números inteiros.");
  expect(mocks.adjust).not.toHaveBeenCalled();
});

it("previews the new balance and sends the chosen kind (UX-10)", async () => {
  mocks.adjust.mockResolvedValue({ success: "Estoque atualizado." });
  openDialog();

  fireEvent.change(await screen.findByLabelText("Quantidade que chegou"), { target: { value: "6" } });
  expect(screen.getByText("8 unidades")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("radio", { name: /correção/ }));
  fireEvent.change(screen.getByLabelText("Quantidade contada"), { target: { value: "5" } });
  expect(screen.getByText("5 unidades")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Salvar ajuste" }));

  expect(mocks.adjust).toHaveBeenCalledWith("cvariant0001", { kind: "CORRECTION", quantity: 5, note: undefined });
  expect(await screen.findByText("Estoque atualizado.")).toBeInTheDocument();
});
