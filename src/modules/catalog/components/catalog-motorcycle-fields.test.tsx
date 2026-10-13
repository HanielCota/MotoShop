import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CatalogMotorcycleFields } from "./catalog-motorcycle-fields";

const fitments = [
  { id: "crf-2025", manufacturer: "Honda", model: "CRF 250R", version: "", displacementCc: 250, year: 2025 },
  { id: "crf-2024", manufacturer: "Honda", model: "CRF 250R", version: "", displacementCc: 250, year: 2024 },
  { id: "crf450-2025", manufacturer: "Honda", model: "CRF 450R", version: "", displacementCc: 450, year: 2025 },
  { id: "yz-2025", manufacturer: "Yamaha", model: "YZ250F", version: "", displacementCc: 250, year: 2025 },
];

function renderFields(defaultFitmentId = "") {
  const { container } = render(
    <form>
      <CatalogMotorcycleFields fitments={fitments} defaultFitmentId={defaultFitmentId} fieldClassName="" />
    </form>,
  );
  return () => container.querySelector<HTMLInputElement>('input[type="hidden"][name="moto"]')?.value;
}

function choose(name: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name }));
  const item = screen.getByRole("option", { name: option });
  fireEvent.pointerDown(item, { pointerType: "mouse" });
  fireEvent.click(item);
}

afterEach(cleanup);

describe("CatalogMotorcycleFields", () => {
  it("submits all motorcycles until a manufacturer is chosen", () => {
    const motoValue = renderFields();

    expect(motoValue()).toBe("all");
    expect(screen.getByRole("combobox", { name: "Fabricante" })).toHaveTextContent("Todos os fabricantes");
    expect(screen.getByRole("combobox", { name: "Modelo" })).toHaveAttribute("data-disabled");
  });

  it("follows manufacturer, model and year like the home finder", () => {
    const motoValue = renderFields();

    choose("Fabricante", "Honda");
    expect(motoValue()).toBe("crf-2025");

    choose("Modelo", "CRF 450R");
    expect(motoValue()).toBe("crf450-2025");

    choose("Fabricante", "Honda");
    choose("Modelo", "CRF 250R");
    choose("Ano e versão", "2024 · 250 cc");
    expect(motoValue()).toBe("crf-2024");
  });

  it("restores the motorcycle from the URL and can go back to all motorcycles", () => {
    const motoValue = renderFields("yz-2025");

    expect(screen.getByRole("combobox", { name: "Fabricante" })).toHaveTextContent("Yamaha");
    expect(screen.getByRole("combobox", { name: "Modelo" })).toHaveTextContent("YZ250F");
    expect(motoValue()).toBe("yz-2025");

    choose("Fabricante", "Todos os fabricantes");
    expect(motoValue()).toBe("all");
  });
});
