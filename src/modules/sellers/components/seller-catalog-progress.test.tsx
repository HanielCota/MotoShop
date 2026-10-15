import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));

import { SellerCatalogProgress } from "./seller-catalog-progress";

afterEach(cleanup);

describe("SellerCatalogProgress", () => {
  it("guides an empty approved store to the first product", () => {
    render(<SellerCatalogProgress progress={{ editable: 0, submitted: 0, approved: 0 }} />);

    expect(screen.getByRole("link", { name: "Cadastrar meu primeiro produto" })).toHaveAttribute(
      "href",
      "/seller/products/new",
    );
    expect(screen.getByText("Primeiro produto publicado")).toBeInTheDocument();
  });

  it("shows the moderation wait without claiming publication", () => {
    render(<SellerCatalogProgress progress={{ editable: 0, submitted: 1, approved: 0 }} />);

    expect(screen.getByText(/aguardando análise pelo Moto Shop/i)).toBeInTheDocument();
    expect(screen.queryByText(/produto\(s\) publicado/i)).not.toBeInTheDocument();
  });

  it("leaves the overview once a product is published (UX-09)", () => {
    const { container } = render(<SellerCatalogProgress progress={{ editable: 2, submitted: 1, approved: 1 }} />);

    expect(container).toBeEmptyDOMElement();
  });
});
