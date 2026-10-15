import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ approve: vi.fn(), reject: vi.fn() }));
vi.mock("@/modules/products/actions/product-actions", () => ({
  approveProductAction: mocks.approve,
  rejectProductAction: mocks.reject,
}));

import { ProductStatusActions } from "./product-status-actions";

beforeEach(() => {
  mocks.approve.mockReset();
  mocks.approve.mockResolvedValue({ success: "Produto aprovado." });
});
afterEach(cleanup);

it("approves a product with photos in one click", async () => {
  render(<ProductStatusActions productId="cproduct0001" />);

  fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));

  expect(await screen.findByText("Produto aprovado.")).toBeInTheDocument();
  expect(mocks.approve).toHaveBeenCalledWith("cproduct0001");
});

it("asks for confirmation before approving a product without photos (UX-14)", async () => {
  render(<ProductStatusActions productId="cproduct0001" hasImages={false} />);

  fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));
  expect(await screen.findByText("Este produto não tem fotos. Ele aparecerá sem imagem na loja.")).toBeInTheDocument();
  expect(mocks.approve).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Aprovar mesmo assim" }));

  expect(await screen.findByText("Produto aprovado.")).toBeInTheDocument();
  expect(mocks.approve).toHaveBeenCalledWith("cproduct0001");
});

it("uses the same 'Recusar' wording as the other queues", () => {
  render(<ProductStatusActions productId="cproduct0001" />);

  expect(screen.getByRole("button", { name: "Recusar" })).toBeInTheDocument();
  expect(screen.getByLabelText("Motivo da recusa")).toBeInTheDocument();
});
