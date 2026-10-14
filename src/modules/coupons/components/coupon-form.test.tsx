import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../actions/coupon-actions", () => ({
  createMarketplaceCouponAction: mocks.create,
  createSellerCouponAction: mocks.create,
}));

import { CouponForm } from "./coupon-form";

afterEach(cleanup);

it("keeps what the admin typed when the server refuses the coupon", async () => {
  mocks.create.mockResolvedValue({ error: "Use de 3 a 40 caracteres: letras, números, _ ou -." });
  render(<CouponForm ownerType="MARKETPLACE" />);

  fireEvent.change(screen.getByLabelText(/Código do cupom/), { target: { value: "AB" } });
  fireEvent.change(screen.getByLabelText(/Desconto \(%\)/), { target: { value: "10" } });
  fireEvent.click(screen.getByRole("button", { name: "Criar cupom" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Use de 3 a 40 caracteres");
  expect(screen.getByLabelText(/Código do cupom/)).toHaveValue("AB");
  expect(screen.getByLabelText(/Desconto \(%\)/)).toHaveValue("10");
});

it("offers the product page option only on seller coupons and sends it when ticked", async () => {
  mocks.create.mockResolvedValue({ success: "Cupom criado." });
  const { unmount } = render(<CouponForm ownerType="MARKETPLACE" />);
  expect(screen.queryByText("Mostrar na página do produto")).not.toBeInTheDocument();
  unmount();

  render(<CouponForm ownerType="SELLER" />);
  fireEvent.change(screen.getByLabelText(/Código do cupom/), { target: { value: "TRILHA10" } });
  fireEvent.change(screen.getByLabelText(/Desconto \(%\)/), { target: { value: "10" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Criar cupom" }));

  expect(await screen.findByRole("status")).toHaveTextContent("Cupom criado.");
  const formData = mocks.create.mock.calls[0]?.[1] as FormData;
  expect(formData.get("showOnProductPage")).toBe("on");
});

it("sends a seller-funded campaign by default from the Admin form, and no kind from the seller form", async () => {
  mocks.create.mockResolvedValue({ success: "Cupom criado." });
  const { unmount } = render(<CouponForm ownerType="MARKETPLACE" />);
  expect(screen.getByLabelText("Tipo de cupom")).toHaveTextContent("Campanha com adesão");
  fireEvent.change(screen.getByLabelText(/Código do cupom/), { target: { value: "TRILHA10" } });
  fireEvent.change(screen.getByLabelText(/Desconto \(%\)/), { target: { value: "10" } });
  fireEvent.click(screen.getByRole("button", { name: "Criar cupom" }));
  await screen.findByRole("status");
  expect((mocks.create.mock.calls[0]?.[1] as FormData).get("couponKind")).toBe("SELLER_FUNDED_CAMPAIGN");
  unmount();

  render(<CouponForm ownerType="SELLER" />);
  expect(screen.queryByLabelText("Tipo de cupom")).not.toBeInTheDocument();
});

it("shows the coupon rule in the browser and does not call the server for an invalid code (BUG-011)", async () => {
  render(<CouponForm ownerType="SELLER" />);
  fireEvent.change(screen.getByLabelText(/Código do cupom/), { target: { value: "AB" } });
  fireEvent.change(screen.getByLabelText(/Desconto \(%\)/), { target: { value: "10" } });
  fireEvent.click(screen.getByRole("button", { name: "Criar cupom" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Use de 3 a 40 caracteres");
  expect(mocks.create).not.toHaveBeenCalled();
});
