import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));

import { ProductCompatibilityCard } from "./product-compatibility-card";
import { ProductFitmentBanner } from "./product-fitment-banner";

const motorcycleLabel = "Honda CRF 250R · padrão · 2025";
const picker = <form aria-label="Seletor de moto" />;

afterEach(cleanup);

describe("ProductFitmentBanner", () => {
  it("sends the customer to the store when no compatibility was informed", () => {
    const { container } = render(
      <ProductFitmentBanner status={{ kind: "unknown", motorcycleLabel }} picker={picker} />,
    );

    expect(screen.getByText("A loja não informou compatibilidade")).toBeInTheDocument();
    expect(screen.getByText(/Antes de comprar, pergunte à loja se esta peça serve\./)).toBeInTheDocument();
    expect(screen.queryByText(/veja a lista de motos compatíveis/)).not.toBeInTheDocument();
    // Neutral, not a warning: gear that fits any bike has no compatibility list.
    expect(container.querySelector("#sua-moto")).not.toHaveClass("bg-warning-surface");
  });

  it("still points to the compatible list when the motorcycle is not in it", () => {
    render(<ProductFitmentBanner status={{ kind: "does-not-fit", motorcycleLabel }} picker={picker} />);

    expect(screen.getByText(/veja a lista de motos compatíveis/)).toBeInTheDocument();
  });
});

describe("motorcycle picker next to the price", () => {
  it("opens the picker in place instead of jumping to the end of the page", () => {
    render(<ProductFitmentBanner status={{ kind: "no-motorcycle" }} picker={picker} />);

    const toggle = screen.getByText("Escolher minha moto");
    expect(toggle.tagName).toBe("SUMMARY");
    expect(toggle.closest("details")).not.toHaveAttribute("open");
    expect(screen.queryByRole("link", { name: "Escolher minha moto" })).not.toBeInTheDocument();
    expect(toggle.closest("details")?.querySelector("form")).toHaveAttribute("aria-label", "Seletor de moto");
  });

  it("lets the customer change the motorcycle from the same place", () => {
    render(<ProductFitmentBanner status={{ kind: "fits", motorcycleLabel }} picker={picker} />);

    expect(screen.getByText("Trocar moto").tagName).toBe("SUMMARY");
  });
});

describe("ProductCompatibilityCard", () => {
  it("only lists the motorcycles the store confirmed, without a second picker", () => {
    render(<ProductCompatibilityCard compatibilities={[]} selectedFitmentId={null} />);

    expect(screen.getByText("Motos em que a loja confirmou que esta peça serve.")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
