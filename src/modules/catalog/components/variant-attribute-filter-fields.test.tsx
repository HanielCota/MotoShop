import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { VariantAttributeFilterFields, variantAttributeChipLabels } from "./variant-attribute-filter-fields";

const noValues = { gender: null, color: null, size: null };

afterEach(cleanup);

describe("VariantAttributeFilterFields", () => {
  it("shows a select per attribute with the current choice", () => {
    render(
      <form>
        <VariantAttributeFilterFields
          options={{ genders: ["FEMALE", "UNISEX"], colors: ["Azul", "Preto"], sizes: ["M"] }}
          values={{ gender: "FEMALE", color: "Preto", size: null }}
          fieldClassName=""
        />
      </form>,
    );

    expect(screen.getByRole("combobox", { name: "Gênero" })).toHaveTextContent("Feminino");
    expect(screen.getByRole("combobox", { name: "Cor" })).toHaveTextContent("Preto");
    expect(screen.getByRole("combobox", { name: "Tamanho" })).toHaveTextContent("Todos os tamanhos");
  });

  it("leaves out attributes without any public value", () => {
    render(
      <form>
        <VariantAttributeFilterFields
          options={{ genders: [], colors: ["Preto"], sizes: [] }}
          values={noValues}
          fieldClassName=""
        />
      </form>,
    );

    expect(screen.queryByRole("combobox", { name: "Gênero" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Cor" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Tamanho" })).not.toBeInTheDocument();
  });

  it("labels the active filter chips", () => {
    expect(variantAttributeChipLabels({ gender: "UNISEX", color: "Preto", size: null })).toEqual({
      gender: "Gênero: Unissex",
      color: "Cor: Preto",
      size: null,
    });
  });
});
