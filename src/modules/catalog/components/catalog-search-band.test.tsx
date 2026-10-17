import { cleanup, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("@/modules/products/components/search/search-form", () => ({
  SearchForm: ({ placeholder, inputClassName }: { placeholder: string; inputClassName?: string }) => (
    <input aria-label="Buscar no catálogo" placeholder={placeholder} className={inputClassName} />
  ),
}));

import { CatalogSearchBand } from "./catalog-search-band";

afterEach(cleanup);

describe("CatalogSearchBand", () => {
  it("highlights the field and shows an example search in the placeholder", () => {
    render(<CatalogSearchBand defaultValue="" preservedEntries={[]} />);
    const field = screen.getByRole("textbox", { name: "Buscar no catálogo" });

    expect(field).toHaveAttribute("placeholder", "Busque por peça, marca ou moto. Ex.: pastilha de freio CRF 250R");
    expect(field.className).toContain("border-moto-brand");
  });

  it("suggests ready searches before the first search, keeping the applied filters", () => {
    render(
      <CatalogSearchBand
        defaultValue=""
        preservedEntries={[
          ["category", "cat-1"],
          ["sort", "price-asc"],
        ]}
      />,
    );
    const suggestions = within(screen.getByRole("navigation", { name: "Sugestões de busca" }));

    expect(suggestions.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Capacete",
      "Bota",
      "Disco de freio",
      "Óculos",
    ]);
    expect(suggestions.getByRole("link", { name: "Disco de freio" })).toHaveAttribute(
      "href",
      "/products?category=cat-1&sort=price-asc&q=Disco+de+freio",
    );
  });

  it("hides the suggestions once the customer has searched", () => {
    render(<CatalogSearchBand defaultValue="capacete" preservedEntries={[]} />);

    expect(screen.queryByRole("navigation", { name: "Sugestões de busca" })).not.toBeInTheDocument();
  });
});
