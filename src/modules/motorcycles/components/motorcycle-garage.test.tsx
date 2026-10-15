import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

vi.mock("../actions/saved-motorcycle-actions", () => ({
  addSavedMotorcycleAction: vi.fn(),
  changeSavedMotorcycleAction: vi.fn(),
  removeSavedMotorcycleAction: vi.fn(),
  setPrimarySavedMotorcycleAction: vi.fn(),
}));

import { MotorcycleGarage } from "./motorcycle-garage";

afterEach(cleanup);

const saved = (overrides: Partial<Parameters<typeof MotorcycleGarage>[0]["savedMotorcycles"][number]> = {}) => ({
  id: "saved-1",
  motorcycleFitmentId: "fitment-1",
  label: "Honda CRF 250R · padrão · 250 cc · 2025",
  manufacturer: "Honda",
  model: "CRF 250R",
  version: "",
  year: 2025,
  isPrimary: true,
  available: true,
  compatibleProductCount: 3,
  ...overrides,
});

function card(name: string) {
  const article = screen.getByRole("heading", { name }).closest("article");
  if (!article) throw new Error(`Expected a card for ${name}`);
  return within(article);
}

it("shows manufacturer, model, version and year as separate fields", () => {
  render(<MotorcycleGarage fitments={[]} savedMotorcycles={[saved()]} />);

  const honda = card("Honda CRF 250R");
  for (const [label, value] of [
    ["Fabricante", "Honda"],
    ["Modelo", "CRF 250R"],
    ["Versão", "Padrão"],
    ["Ano", "2025"],
  ] as const)
    expect(honda.getByText(label).nextElementSibling).toHaveTextContent(value);
  expect(honda.getByRole("link", { name: "Ver peças compatíveis" })).toHaveAttribute(
    "href",
    "/products?moto=fitment-1",
  );
});

it("says no equipment was found and hides the catalog link when nothing is compatible", () => {
  render(
    <MotorcycleGarage
      fitments={[]}
      savedMotorcycles={[
        saved({ manufacturer: "KTM", model: "450 SX-F", version: "Factory Edition", compatibleProductCount: 0 }),
      ]}
    />,
  );

  const ktm = card("KTM 450 SX-F");
  expect(ktm.getByText("Não encontramos nenhum equipamento para esta moto.")).toBeInTheDocument();
  expect(ktm.getByText("Factory Edition")).toBeInTheDocument();
  expect(ktm.queryByRole("link", { name: "Ver peças compatíveis" })).not.toBeInTheDocument();
});
