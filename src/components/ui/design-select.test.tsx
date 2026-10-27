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
    expect(screen.getByRole("combobox", { name: "Marca" })).toHaveAttribute("aria-required", "true");
    selectOption("Marca", "Fox");
    expect(new FormData(defined(form)).get("brandId")).toBe("fox");
    expect(defined(form).checkValidity()).toBe(true);
    selectOption("Marca", "Selecione");
    expect(new FormData(defined(form)).get("brandId")).toBe("");
    expect(defined(form).checkValidity()).toBe(true);
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

  it("announces required without the browser validation bubble", () => {
    const { container } = render(
      <form>
        <DesignSelect aria-label="Moto" name="fitmentId" required defaultValue="">
          <option value="">Selecione</option>
          <option value="crf">CRF 250R</option>
        </DesignSelect>
      </form>,
    );

    expect(screen.getByRole("combobox", { name: "Moto" })).toHaveAttribute("aria-required", "true");
    expect(defined(container.querySelector("form")).checkValidity()).toBe(true);
  });

  it("opens the list beside the trigger instead of over it, so small screens keep room for options", () => {
    render(
      <DesignSelect aria-label="Categoria" defaultValue="">
        <option value="">Todas</option>
        <option value="capacetes">Capacetes</option>
      </DesignSelect>,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Categoria" }));

    const positioner = screen.getByRole("listbox").closest("[data-side]");
    expect(positioner).not.toBeNull();
    expect(positioner).not.toHaveAttribute("data-side", "none");
  });

  it("fits the 8 order status options without a scrollbar and still caps the list at the space available", () => {
    render(
      <DesignSelect aria-label="Status do pedido" defaultValue="ALL">
        <option value="ALL">Todos</option>
      </DesignSelect>,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Status do pedido" }));

    const list = defined(document.querySelector<HTMLElement>("[class*='--available-height']"));
    const cap = /max-h-\[min\(var\(--available-height\),(\d+)rem\)\]/.exec(list.className);
    const capInPixels = Number(defined(cap)[1]) * PIXELS_PER_REM;
    expect(capInPixels).toBeGreaterThanOrEqual(
      ORDER_STATUS_OPTION_COUNT * OPTION_HEIGHT_IN_PIXELS + LIST_PADDING_IN_PIXELS,
    );
  });
});

const PIXELS_PER_REM = 16;
// Each option is py-2 (16px) plus a text-sm line (20px); the list has p-1 (4px) above and below.
const OPTION_HEIGHT_IN_PIXELS = 36;
const LIST_PADDING_IN_PIXELS = 8;
// "Todos" plus the 7 order statuses of the Admin orders filter.
const ORDER_STATUS_OPTION_COUNT = 8;

function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Expected value to be defined");
  return value;
}
