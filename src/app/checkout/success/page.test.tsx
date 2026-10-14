import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import CheckoutSuccessPage from "./page";

it("does not claim an order was created when the order number is missing", async () => {
  render(await CheckoutSuccessPage({ searchParams: Promise.resolve({}) }));

  expect(screen.getByRole("heading", { level: 1, name: "Não foi possível identificar o pedido" })).toBeInTheDocument();
  expect(screen.queryByText(/Pedido:/)).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Ver pagamento e acompanhar pedido" })).not.toBeInTheDocument();
});

it("does not claim an order was created based only on a query parameter", async () => {
  render(
    await CheckoutSuccessPage({
      searchParams: Promise.resolve({ orderNumber: "MS-202609-ABC12345", accessToken: "guest-token" }),
    }),
  );

  expect(screen.getByRole("heading", { level: 1, name: "Acompanhe seu pedido" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { level: 1, name: "Pedido criado" })).not.toBeInTheDocument();
  expect(screen.getByText("MS-202609-ABC12345")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ver pagamento e acompanhar pedido" })).toHaveAttribute(
    "href",
    "/orders/MS-202609-ABC12345/access?token=guest-token",
  );
});
