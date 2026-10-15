import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));

import { ProductCompatibilityCard } from "./product-compatibility-card";
import { ProductFitmentBanner } from "./product-fitment-banner";

const motorcycleLabel = "Honda CRF 250R · padrão · 2025";

afterEach(cleanup);

describe("ProductFitmentBanner", () => {
  it("sends the customer to the store when no compatibility was informed", () => {
    render(<ProductFitmentBanner status={{ kind: "unknown", motorcycleLabel }} />);

    expect(screen.getByText("A loja não informou compatibilidade")).toBeInTheDocument();
    expect(screen.getByText(/Antes de comprar, pergunte à loja se esta peça serve\./)).toBeInTheDocument();
    expect(screen.queryByText(/veja a lista de motos compatíveis/)).not.toBeInTheDocument();
    // Neutral, not a warning: gear that fits any bike has no compatibility list.
    expect(screen.getByRole("status")).not.toHaveClass("bg-warning-surface");
  });

  it("still points to the compatible list when the motorcycle is not in it", () => {
    render(<ProductFitmentBanner status={{ kind: "does-not-fit", motorcycleLabel }} />);

    expect(screen.getByText(/veja a lista de motos compatíveis/)).toBeInTheDocument();
  });
});

describe("ProductCompatibilityCard", () => {
  it("stops asking for a motorcycle once one is chosen", () => {
    const { rerender } = render(
      <ProductCompatibilityCard compatibilities={[]} selectedFitmentId={null} status={null} picker={null} />,
    );
    expect(screen.getByText("Informe sua moto para conferir se esta peça é compatível.")).toBeInTheDocument();

    rerender(
      <ProductCompatibilityCard compatibilities={[]} selectedFitmentId="fitment-1" status={null} picker={null} />,
    );
    expect(screen.getByText("Confira abaixo se esta peça serve na moto escolhida.")).toBeInTheDocument();
    expect(screen.queryByText(/Informe sua moto para conferir/)).not.toBeInTheDocument();
  });
});
