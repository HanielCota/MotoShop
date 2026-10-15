import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ProductPageCoupons } from "./product-page-coupons";

afterEach(cleanup);

const coupon = {
  code: "BOX25",
  discount: "R$ 25,00 de desconto",
  minimumPurchase: "Compra mínima de R$ 150,00",
  validity: "Válido até 31/10/2026",
};

it("renders nothing without coupons", () => {
  const { container } = render(<ProductPageCoupons coupons={[]} />);
  expect(container).toBeEmptyDOMElement();
});

it("shows code, discount, minimum purchase and validity", () => {
  render(<ProductPageCoupons coupons={[coupon]} />);

  expect(screen.getByRole("heading", { name: "Cupons desta loja" })).toBeInTheDocument();
  expect(screen.getByText("BOX25")).toBeInTheDocument();
  expect(screen.getByText("R$ 25,00 de desconto")).toBeInTheDocument();
  expect(screen.getByText("Compra mínima de R$ 150,00 · Válido até 31/10/2026")).toBeInTheDocument();
});

it("copies the code and confirms", async () => {
  const writeText = vi.fn(async () => undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  render(<ProductPageCoupons coupons={[coupon]} />);

  fireEvent.click(screen.getByRole("button", { name: "Copiar código BOX25" }));

  expect(await screen.findByText("Copiado")).toBeInTheDocument();
  expect(writeText).toHaveBeenCalledWith("BOX25");
});

it("asks to copy manually when the clipboard is blocked", async () => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) } });
  render(<ProductPageCoupons coupons={[coupon]} />);

  fireEvent.click(screen.getByRole("button", { name: "Copiar código BOX25" }));

  expect(await screen.findByText("Copie manualmente")).toBeInTheDocument();
});
