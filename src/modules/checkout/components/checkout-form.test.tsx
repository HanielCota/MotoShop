import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
const quote = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../actions/checkout-actions", () => ({ createCheckoutAction: vi.fn() }));
vi.mock("../actions/shipping-actions", () => ({ quoteShippingAction: quote }));
vi.mock("@/modules/payments/components/secure-card-fields", () => ({ SecureCardFields: () => null }));
import { CheckoutForm } from "./checkout-form";
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
it("ignores a late quote for the previous postal code", async () => {
  let resolve!: (value: unknown) => void;
  quote.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  render(<CheckoutForm cartSummary={{ itemCount: 1, itemsSubtotalInCents: 100 }} />);
  fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01001000" } });
  fireEvent.click(screen.getByRole("button", { name: "Calcular frete" }));
  fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "20040002" } });
  await act(async () =>
    resolve({
      quotes: [
        {
          sellerId: "seller",
          storeName: "Old quote store",
          quotes: [
            { provider: "OWN", serviceCode: "own:test", carrier: "Loja", service: "Entrega", priceInCents: 1000 },
          ],
        },
      ],
    }),
  );
  expect(screen.queryByText("Old quote store")).toBeNull();
  expect(screen.getByRole("button", { name: "Finalizar pedido" })).toBeDisabled();
});
it("shows a recoverable error when the quote request rejects", async () => {
  quote.mockRejectedValue(new Error("offline"));
  render(<CheckoutForm cartSummary={{ itemCount: 1, itemsSubtotalInCents: 100 }} />);
  fireEvent.click(screen.getByRole("button", { name: "Calcular frete" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("conexão");
  expect(await screen.findByRole("button", { name: "Calcular frete" })).toBeEnabled();
});

it("does not invite the customer to pay before the seller connects a Mercado Pago account", () => {
  render(<CheckoutForm paymentAvailable={false} cartSummary={{ itemCount: 1, itemsSubtotalInCents: 100 }} />);

  expect(screen.getByRole("status")).toHaveTextContent("O lojista precisa conectar a conta do Mercado Pago");
  expect(screen.queryByRole("radiogroup", { name: "Forma de pagamento" })).toBeNull();
  expect(screen.getByRole("button", { name: "Pagamento indisponível" })).toBeDisabled();
});
