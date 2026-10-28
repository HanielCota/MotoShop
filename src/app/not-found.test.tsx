import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/modules/products/components/search/search-form", () => ({
  SearchForm: ({ label }: { label: string }) => <form role="search" aria-label={label} />,
}));

import NotFound from "./not-found";

it("keeps the page named for screen readers and offers a search and four ways out", () => {
  render(<NotFound />);

  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Página não encontrada/);
  expect(screen.getByRole("search", { name: "Buscar produtos" })).toBeInTheDocument();
  const paths = within(screen.getByRole("region", { name: "Caminhos rápidos" })).getAllByRole("link");
  expect(paths.map((link) => link.getAttribute("href"))).toEqual(["/products", "/#minha-moto", "/orders", "/"]);
});
