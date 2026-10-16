import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));

import { ProductCard, type ProductCardData } from "./product-card";

afterEach(cleanup);

function card(imageUrl: string): ProductCardData {
  return {
    id: "product-1",
    name: "Capacete Apex",
    href: "/products/capacete-apex",
    imageUrl,
    imageAlt: "Capacete Apex",
    category: { label: "Capacetes" },
    priceInCents: 149990,
    hasPriceRange: false,
    availableQuantity: 3,
    sponsored: false,
    isNew: false,
  };
}

it("lets next/image resize local demo photos to the card width", () => {
  render(<ProductCard product={card("/images/demo/capacete-apex.webp")} />);
  const image = screen.getByRole("img", { name: "Capacete Apex" });

  expect(image).toHaveAttribute("sizes", expect.stringContaining("50vw"));
  expect(image.getAttribute("srcset")).toContain("/_next/image?url=%2Fimages%2Fdemo%2Fcapacete-apex.webp");
  expect(image).toHaveAttribute("loading", "lazy");
});

it("serves ImageKit images as already-resized URLs, without the Next optimizer", () => {
  const url = "https://ik.imagekit.io/motoshop/products/apex.webp?tr=w-640";
  render(<ProductCard product={card(url)} eager />);
  const image = screen.getByRole("img", { name: "Capacete Apex" });

  expect(image).toHaveAttribute("src", url);
  expect(image).not.toHaveAttribute("srcset");
  expect(image).toHaveAttribute("loading", "eager");
});

it("shows the price range and the sponsored badge without any demo notice (margot#350)", () => {
  render(
    <ProductCard product={{ ...card("/images/demo/capacete-apex.webp"), hasPriceRange: true, sponsored: true }} />,
  );

  expect(screen.getByText("A partir de")).toBeInTheDocument();
  expect(screen.getByText("Patrocinado · Loja VIP")).toBeInTheDocument();
  expect(screen.queryByText(/demonstração/i)).not.toBeInTheDocument();
});
