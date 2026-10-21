import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { VariantAttributeFilterFields, variantAttributeChipLabels } from "./variant-attribute-filter-fields";

const noValues = { gender: null, color: null, size: null };

afterEach(cleanup);

describe("VariantAttributeFilterFields", () => {
  it("shows a select per attribute with the current choice", () => {
    render(
      <form>
        <VariantAttributeFilterFields
          options={{ colors: ["Azul", "Preto"], sizes: ["M"] }}
          values={{ gender: "FEMALE", color: "Preto", size: null }}
          fieldClassName=""
        />
      </form>,
    );

    expect(screen.getByRole("combobox", { name: "Gênero" })).toHaveTextContent("Feminino");
    expect(screen.getByRole("combobox", { name: "Cor" })).toHaveTextContent("Preto");
    expect(screen.getByRole("combobox", { name: "Tamanho" })).toHaveTextContent("Todos os tamanhos");
  });

  it("leaves out color and size without any public value, but always offers gender", () => {
    render(
      <form>
        <VariantAttributeFilterFields options={{ colors: ["Preto"], sizes: [] }} values={noValues} fieldClassName="" />
      </form>,
    );

    expect(screen.getByRole("combobox", { name: "Gênero" })).toHaveTextContent("Todos os gêneros");
    expect(screen.getByRole("combobox", { name: "Cor" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Tamanho" })).not.toBeInTheDocument();
  });

  it("offers Masculino, Feminino and Unissex even when no product has a gender", async () => {
    render(
      <form>
        <VariantAttributeFilterFields options={{ colors: [], sizes: [] }} values={noValues} fieldClassName="" />
      </form>,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Gênero" }));

    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "Todos os gêneros",
      "Masculino",
      "Feminino",
      "Unissex",
    ]);
  });

  it("shows a decorative swatch next to colors with a known tone", async () => {
    render(
      <form>
        <VariantAttributeFilterFields
          options={{ colors: ["Azul/amarelo", "Camuflado", "Preta"], sizes: [] }}
          values={noValues}
          fieldClassName=""
        />
      </form>,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Cor" }));
    const options = await screen.findAllByRole("option");
    const swatchOf = (name: string) =>
      options.find((option) => option.textContent === name)?.querySelector("[data-testid=color-swatch]");

    expect(swatchOf("Azul/amarelo")).toHaveAttribute("aria-hidden", "true");
    expect(swatchOf("Azul/amarelo")?.getAttribute("style")).toContain("linear-gradient");
    expect(swatchOf("Preta")).not.toBeNull();
    expect(swatchOf("Camuflado")).toBeNull();
  });

  it("labels the active filter chips", () => {
    expect(variantAttributeChipLabels({ gender: "UNISEX", color: "Preto", size: null })).toEqual({
      gender: "Gênero: Unissex",
      color: "Cor: Preto",
      size: null,
    });
  });
});
