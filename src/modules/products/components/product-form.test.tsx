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
  expect(screen.getByLabelText(/^Endereço da página/)).toHaveValue("capacete-fox-v1");

  fireEvent.change(screen.getByLabelText(/^Endereço da página/), { target: { value: "meu-slug" } });
  fireEvent.change(productName(), { target: { value: "Outro nome" } });
  expect(screen.getByLabelText(/^Endereço da página/)).toHaveValue("meu-slug");
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
  expect(screen.getByLabelText(/^Cor/)).toHaveAttribute("placeholder", "Ex.: Preto/laranja");
  expect(screen.getByLabelText(/^Tamanho/)).toHaveAttribute("placeholder", "Ex.: M ou 40");
});

it("uses text date and time fields for the promotion instead of the native picker (DN-01)", async () => {
  render(<ProductForm {...options} />);

  const start = screen.getByLabelText("Início da promoção");
  expect(start).toHaveAttribute("placeholder", "dd/mm/aaaa");
  expect(start).not.toHaveAttribute("type", "datetime-local");
  expect(screen.getByLabelText("Hora: término da promoção")).toHaveAttribute("placeholder", "23:59");

  fireEvent.change(screen.getByLabelText("Término da promoção"), { target: { value: "31/11/2026" } });
  fireEvent.click(screen.getByRole("button", { name: "Criar rascunho" }));

  await waitFor(() =>
    expect(screen.getByLabelText("Término da promoção")).toHaveAccessibleDescription(/Data final inválida/),
  );
});

it("adds the slashes while the promotion date is typed", () => {
  render(<ProductForm {...options} />);
  const start = screen.getByLabelText("Início da promoção");

  fireEvent.change(start, { target: { value: "01112026" } });
  expect(start).toHaveValue("01/11/2026");
});

it("does not use native number fields that change with the mouse wheel (DN-07)", () => {
  const { container } = render(<ProductForm {...options} />);

  expect(container.querySelector('input[type="number"]')).toBeNull();
  expect(screen.getByLabelText(/^Estoque/)).toHaveAttribute("inputmode", "numeric");
});

it("shows the three steps and keeps the page address closed while it follows the name", () => {
  render(<ProductForm {...options} />);

  expect(screen.getByRole("list", { name: "Etapas do cadastro" })).toHaveTextContent(
    "1Dados e variações2Fotos3Enviar para aprovação",
  );
  expect(screen.getByLabelText(/^Endereço da página/).closest("details")).not.toHaveAttribute("open");
});

it("keeps the page address open while the seller fixes an address error", async () => {
  render(<ProductForm {...options} />);

  fireEvent.submit(screen.getByRole("button", { name: "Criar rascunho" }).closest("form") as HTMLFormElement);
  const slug = screen.getByLabelText(/^Endereço da página/);
  await waitFor(() => expect(slug.closest("details")).toHaveAttribute("open"));

  fireEvent.change(slug, { target: { value: "capacete-novo" } });
  fireEvent.blur(slug);

  await waitFor(() =>
    expect(screen.queryByText(/endereço/i, { selector: "[role=alert], .text-destructive" })).toBeNull(),
  );
  expect(slug.closest("details")).toHaveAttribute("open");
});
