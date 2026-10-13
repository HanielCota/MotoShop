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
