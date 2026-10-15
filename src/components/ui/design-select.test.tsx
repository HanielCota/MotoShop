import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DesignSelect } from "./design-select";

afterEach(cleanup);

function selectOption(name: string, option: string) {
  const trigger = screen.getByRole("combobox", { name });
  if (trigger.getAttribute("aria-expanded") !== "true") fireEvent.click(trigger);
  const item = screen.getByRole("option", { name: option });
  fireEvent.pointerDown(item, { pointerType: "mouse" });
  fireEvent.click(item);
}

describe("DesignSelect", () => {
  it("keeps the selected value in form submission and supports an empty option", () => {
    const { container } = render(
      <form>
        <label>
          Marca
          <DesignSelect aria-label="Marca" name="brandId" defaultValue="" required>
            <option value="">Selecione</option>
            <option value="fox">Fox</option>
          </DesignSelect>
        </label>
      </form>,
    );
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    expect(screen.getByRole("combobox", { name: "Marca" })).toHaveTextContent("Selecione");
    expect(defined(form).checkValidity()).toBe(false);
    selectOption("Marca", "Fox");
    expect(new FormData(defined(form)).get("brandId")).toBe("fox");
    expect(defined(form).checkValidity()).toBe(true);
    selectOption("Marca", "Selecione");
    expect(new FormData(defined(form)).get("brandId")).toBe("");
    expect(defined(form).checkValidity()).toBe(false);
  });

  it("submits every selected motorcycle as a separate value", () => {
    const { container } = render(
      <form>
        <label>
          Motos compatíveis
          <DesignSelect aria-label="Motos compatíveis" name="motorcycleFitmentIds" multiple>
            <option value="honda">Honda CRF</option>
            <option value="yamaha">Yamaha YZ</option>
          </DesignSelect>
        </label>
      </form>,
    );
    selectOption("Motos compatíveis", "Honda CRF");
    selectOption("Motos compatíveis", "Yamaha YZ");
    expect(new FormData(defined(container.querySelector("form"))).getAll("motorcycleFitmentIds")).toEqual([
      "honda",
      "yamaha",
    ]);
  });

  it("does not open when disabled", () => {
    render(
      <DesignSelect aria-label="Modelo" disabled>
        <option value="yz">YZ</option>
      </DesignSelect>,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Modelo" }));
    expect(screen.queryByRole("option", { name: "YZ" })).not.toBeInTheDocument();
  });
});

function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Expected value to be defined");
  return value;
}
