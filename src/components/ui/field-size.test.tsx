import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DateFilterInput } from "./date-filter-input";
import { DesignSelect } from "./design-select";
import { Input } from "./input";

afterEach(cleanup);

describe("field size scale", () => {
  it("gives fields 44px by default on every screen, like the default button", () => {
    render(<Input aria-label="Nome" />);
    const input = screen.getByRole("textbox", { name: "Nome" });

    expect(input).toHaveClass("h-11");
    expect(input.className).not.toMatch(/sm:h-/);
  });

  it("keeps sm fields at 44px on phones and 36px from sm up", () => {
    render(<Input aria-label="Filtro" size="sm" />);

    expect(screen.getByRole("textbox", { name: "Filtro" })).toHaveClass("h-11", "sm:h-9");
  });

  it("matches the lg button height", () => {
    render(<Input aria-label="Busca" size="lg" />);

    expect(screen.getByRole("textbox", { name: "Busca" })).toHaveClass("h-12");
  });

  it("applies the same scale to the select trigger and the date filter", () => {
    render(
      <>
        <DesignSelect aria-label="Status" size="sm" defaultValue="">
          <option value="">Todos</option>
        </DesignSelect>
        <DateFilterInput name="from" size="sm" />
      </>,
    );

    expect(screen.getByRole("combobox", { name: "Status" })).toHaveClass("h-11", "sm:h-9");
    expect(screen.getByPlaceholderText("dd/mm/aaaa")).toHaveClass("h-11", "sm:h-9");
  });
});
