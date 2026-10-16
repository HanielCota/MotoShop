import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { CardTitle } from "./card";

afterEach(cleanup);

it("renders the card title as an h2 by default", () => {
  render(<CardTitle>Pedidos da loja</CardTitle>);

  expect(screen.getByRole("heading", { level: 2, name: "Pedidos da loja" })).toHaveClass("text-lg");
});

it("can be an h3 inside a titled section", () => {
  render(<CardTitle as="h3">Endereço</CardTitle>);

  expect(screen.getByRole("heading", { level: 3, name: "Endereço" })).toBeInTheDocument();
});
