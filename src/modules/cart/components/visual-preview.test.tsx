import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VisualCartPreview, VisualCheckoutPreview } from "./visual-preview";

vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <div role="img" aria-label={alt} data-src={src} />,
}));

afterEach(cleanup);

describe("visual purchase preview", () => {
  it("shows items from two stores without changing the real cart", () => {
    render(<VisualCartPreview />);

    expect(screen.getByRole("heading", { name: "Pista Norte (demonstração)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Trilha Sul (demonstração)" })).toBeInTheDocument();
    expect(screen.getByText("Itens (5)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver prévia do checkout" })).toHaveAttribute("href", "/checkout?preview=1");
    expect(screen.getByText(/Nada é salvo no carrinho/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /finalizar pedido/i })).not.toBeInTheDocument();
  });

  it("shows an illustrative total but has no payment submission", () => {
    render(<VisualCheckoutPreview />);

    expect(screen.getByText(/2\.283,30/)).toBeInTheDocument();
    expect(screen.getByText(/Pagamento desativado nesta prévia/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /finalizar pedido/i })).not.toBeInTheDocument();
    expect(document.querySelector("form")).toBeNull();
  });
});
