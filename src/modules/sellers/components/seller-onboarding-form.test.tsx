import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/modules/sellers/actions/seller-actions", () => ({ createSellerAction: vi.fn(async () => ({})) }));

import { SellerOnboardingForm } from "./seller-onboarding-form";

afterEach(cleanup);

it("suggests the store identifier from the name until the seller edits it", () => {
  render(<SellerOnboardingForm />);
  const name = screen.getByLabelText("Nome da loja");
  const slug = screen.getByLabelText("Identificador da loja");

  fireEvent.change(name, { target: { value: "Luiz Parts Ação" } });
  expect(slug).toHaveValue("luiz-parts-acao");

  fireEvent.change(slug, { target: { value: "luiz-motos" } });
  fireEvent.change(name, { target: { value: "Outro nome" } });
  expect(slug).toHaveValue("luiz-motos");
});

it("formats the origin CEP while typing", () => {
  render(<SellerOnboardingForm />);
  const postalCode = screen.getByLabelText(/CEP de origem dos envios/);

  fireEvent.change(postalCode, { target: { value: "01001000" } });
  expect(postalCode).toHaveValue("01001-000");
});

it("goes back to suggesting when the seller clears the identifier", () => {
  render(<SellerOnboardingForm />);
  const slug = screen.getByLabelText("Identificador da loja");

  fireEvent.change(slug, { target: { value: "manual" } });
  fireEvent.change(slug, { target: { value: "" } });
  fireEvent.change(screen.getByLabelText("Nome da loja"), { target: { value: "Racing Parts" } });

  expect(slug).toHaveValue("racing-parts");
});

it("shows the identifier problem under the field before calling the server (BUG-011)", async () => {
  const { createSellerAction } = await import("@/modules/sellers/actions/seller-actions");
  render(<SellerOnboardingForm />);
  fireEvent.change(screen.getByLabelText("Nome da loja"), { target: { value: "Luiz Parts" } });
  fireEvent.change(screen.getByLabelText("Identificador da loja"), { target: { value: "!!!" } });
  fireEvent.click(screen.getByRole("button", { name: "Solicitar cadastro da loja" }));

  expect(await screen.findByText("Informe um identificador para a loja.")).toBeInTheDocument();
  expect(screen.getByLabelText("Identificador da loja")).toHaveAttribute("aria-invalid", "true");
  expect(createSellerAction).not.toHaveBeenCalled();
});
