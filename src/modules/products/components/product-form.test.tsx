import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const createProductAction = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("@/modules/products/actions/product-actions", () => ({ createProductAction, updateProductAction: vi.fn() }));

import { ProductForm } from "./product-form";

afterEach(cleanup);

const options = { categories: [], brands: [], fitments: [] };
// "Nome" do produto (com o asterisco de obrigatório), sem casar "Nome da variação".
const productName = (): HTMLElement => screen.getByLabelText((_, element) => element?.id === "product-name");

it("generates the slug from the name until the seller edits it", () => {
  render(<ProductForm {...options} />);
  fireEvent.change(productName(), { target: { value: "Capacete Fóx V1" } });
  expect(screen.getByLabelText(/^Slug/)).toHaveValue("capacete-fox-v1");

  fireEvent.change(screen.getByLabelText(/^Slug/), { target: { value: "meu-slug" } });
  fireEvent.change(productName(), { target: { value: "Outro nome" } });
  expect(screen.getByLabelText(/^Slug/)).toHaveValue("meu-slug");
});

it("shows inline field errors and does not call the action when invalid", async () => {
  render(<ProductForm {...options} />);
  fireEvent.click(screen.getByRole("button", { name: "Criar rascunho" }));

  await waitFor(() => expect(productName()).toHaveAttribute("aria-invalid", "true"));
  expect(productName()).toHaveAccessibleDescription("Informe o nome do produto.");
  expect(screen.getByLabelText(/^SKU/)).toHaveAccessibleDescription("Informe o SKU.");
  expect(createProductAction).not.toHaveBeenCalled();
});

it("offers optional gender, color and size for each variant", () => {
  render(<ProductForm {...options} />);

  expect(screen.getByLabelText(/^Gênero/)).toHaveTextContent("Não informado");
  expect(screen.getByLabelText(/^Cor/)).toHaveAttribute("placeholder", "Preto/laranja");
  expect(screen.getByLabelText(/^Tamanho/)).toHaveAttribute("placeholder", "M ou 40");
});
