import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ refuse: vi.fn() }));
vi.mock("../actions/admin-catalog-actions", () => ({
  createBrandAction: mocks.refuse,
  createCategoryAction: mocks.refuse,
  createMotorcycleFitmentAction: mocks.refuse,
  createMotorcycleManufacturerAction: mocks.refuse,
  createMotorcycleModelAction: mocks.refuse,
}));

import { CategoryForm, MotorcycleFitmentForm } from "./catalog-admin-forms";

afterEach(cleanup);

it("keeps the category fields when the server refuses them", async () => {
  mocks.refuse.mockResolvedValue({ error: "Informe a ordem de exibição como número inteiro, de 0 a 100000." });
  render(<CategoryForm categories={[{ id: "parent-a", label: "Equipamentos" }]} />);

  fireEvent.change(screen.getByLabelText("Nome da categoria"), { target: { value: "Capacetes" } });
  fireEvent.change(screen.getByLabelText("Categoria pai"), { target: { value: "parent-a" } });
  fireEvent.change(screen.getByLabelText("Ordem de exibição"), { target: { value: "-1" } });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Informe a ordem");
  expect(screen.getByLabelText("Nome da categoria")).toHaveValue("Capacetes");
  expect(screen.getByLabelText("Categoria pai")).toHaveValue("parent-a");
  expect(screen.getByLabelText("Ordem de exibição")).toHaveValue(-1);
});

it("keeps the fitment fields when the server refuses them", async () => {
  mocks.refuse.mockResolvedValue({ error: "Informe o ano entre 1900 e 2200." });
  render(<MotorcycleFitmentForm models={[{ id: "model-a", label: "Honda CRF 250R" }]} />);

  fireEvent.change(screen.getByLabelText("Modelo da moto"), { target: { value: "model-a" } });
  fireEvent.change(screen.getByLabelText("Cilindrada (cc)"), { target: { value: "250" } });
  fireEvent.change(screen.getByLabelText("Ano"), { target: { value: "20" } });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Informe o ano");
  expect(screen.getByLabelText("Modelo da moto")).toHaveValue("model-a");
  expect(screen.getByLabelText("Cilindrada (cc)")).toHaveValue(250);
  expect(screen.getByLabelText("Ano")).toHaveValue(20);
});
