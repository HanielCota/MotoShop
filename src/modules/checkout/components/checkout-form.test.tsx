import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const quote = vi.hoisted(() => vi.fn());
const checkout = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../actions/checkout-actions", () => ({ createCheckoutAction: checkout }));
vi.mock("../actions/shipping-actions", () => ({ quoteShippingAction: quote }));
vi.mock("@/modules/payments/components/secure-card-fields", () => ({ SecureCardFields: () => null }));
import { CheckoutForm } from "./checkout-form";

const fetchMock = vi.fn();
const sellerQuote = (storeName: string) => ({
  quotes: [
    {
      sellerId: "seller",
      storeName,
      quotes: [{ provider: "OWN", serviceCode: "own:test", carrier: "Loja", service: "Entrega", priceInCents: 1000 }],
    },
  ],
});

beforeEach(() => {
  vi.resetAllMocks();
  fetchMock.mockRejectedValue(new Error("offline"));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("ignores a late quote for the previous postal code", async () => {
  const pending: ((value: unknown) => void)[] = [];
  quote.mockImplementation(() => new Promise((done) => pending.push(done)));
  render(<CheckoutForm cartSummary={{ itemCount: 1, itemsSubtotalInCents: 100 }} />);
  fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01001000" } });
  expect(quote).toHaveBeenLastCalledWith("01001000");
  fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "20040002" } });
  expect(quote).toHaveBeenLastCalledWith("20040002");
  await act(async () => pending[0]?.(sellerQuote("Old quote store")));
  expect(screen.queryByText("Old quote store")).toBeNull();
  expect(screen.getByRole("button", { name: "Finalizar pedido" })).toBeDisabled();
  // Conclui a cotação atual: transições assíncronas pendentes ficam entrelaçadas entre testes.
  await act(async () => pending[1]?.(sellerQuote("New quote store")));
  expect(await screen.findByText("New quote store")).toBeInTheDocument();
});

it("masks the CEP, quotes automatically and submits only digits to the quote action", async () => {
  quote.mockResolvedValue(sellerQuote("Pista Norte"));
  render(<CheckoutForm cartSummary={{ itemCount: 1, itemsSubtotalInCents: 100 }} />);
  const cep = screen.getByLabelText("CEP");
  fireEvent.change(cep, { target: { value: "01001000" } });
  expect(cep).toHaveValue("01001-000");
  expect(quote).toHaveBeenCalledWith("01001000");
  expect(await screen.findByText("Pista Norte")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Finalizar pedido" })).toBeEnabled();
});

it("fills the address from ViaCEP without overwriting typed values", async () => {
  quote.mockResolvedValue({ quotes: [] });
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ logradouro: "Praça da Sé", bairro: "Sé", localidade: "São Paulo", uf: "SP" }),
  });
  render(<CheckoutForm cartSummary={{ itemCount: 1, itemsSubtotalInCents: 100 }} />);
  fireEvent.change(screen.getByLabelText("Rua"), { target: { value: "Rua digitada" } });
  fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01001-000" } });
  await waitFor(() => expect(screen.getByLabelText("Cidade")).toHaveValue("São Paulo"));
  expect(fetchMock).toHaveBeenCalledWith("https://viacep.com.br/ws/01001000/json/", expect.anything());
  expect(screen.getByLabelText("Rua")).toHaveValue("Rua digitada");
  expect(screen.getByLabelText("Bairro")).toHaveValue("Sé");
  expect(screen.getByLabelText("UF")).toHaveValue("SP");
});

it("shows a recoverable error when the quote request rejects", async () => {
  quote.mockRejectedValue(new Error("offline"));
  render(<CheckoutForm cartSummary={{ itemCount: 1, itemsSubtotalInCents: 100 }} />);
  fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01001000" } });
  expect(await screen.findByRole("alert")).toHaveTextContent("conexão");
  expect(await screen.findByRole("button", { name: "Calcular frete" })).toBeEnabled();
});

it("links field errors and focuses the summary alert when validation fails", async () => {
  quote.mockResolvedValue(sellerQuote("Pista Norte"));
  render(<CheckoutForm cartSummary={{ itemCount: 1, itemsSubtotalInCents: 100 }} />);
  fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01001000" } });
  await screen.findByText("Pista Norte");
  fireEvent.change(screen.getByLabelText("Seu CPF"), { target: { value: "11111111111" } });
  expect(screen.getByLabelText("Seu CPF")).toHaveValue("111.111.111-11");
  fireEvent.click(screen.getByRole("button", { name: "Finalizar pedido" }));

  const alert = await screen.findByText("Revise os campos destacados para continuar.");
  await waitFor(() => expect(alert.closest("[tabindex='-1']")).toHaveFocus());
  const cpf = screen.getByLabelText("Seu CPF");
  expect(cpf).toHaveAttribute("aria-invalid", "true");
  const [errorId] = defined(cpf.getAttribute("aria-describedby")).split(" ");
  expect(document.getElementById(defined(errorId))).toHaveTextContent("Informe um CPF válido.");
  expect(checkout).not.toHaveBeenCalled();
});

it("does not invite the customer to pay while payments are closed, nor blame the store", () => {
  render(<CheckoutForm paymentAvailable={false} cartSummary={{ itemCount: 1, itemsSubtotalInCents: 100 }} />);

  expect(screen.getByText("Pix e cartão aparecem aqui quando os pagamentos forem liberados.")).toBeInTheDocument();
  expect(screen.queryByText(/lojista precisa conectar/)).not.toBeInTheDocument();
  expect(screen.queryByRole("radiogroup", { name: "Forma de pagamento" })).toBeNull();
  expect(screen.getByRole("button", { name: "Pagamento indisponível" })).toBeDisabled();
});

it("prefills the phone and CPF saved in the customer profile", () => {
  render(
    <CheckoutForm
      cartSummary={{ itemCount: 1, itemsSubtotalInCents: 100 }}
      customerDefaults={{ taxId: "52998224725", phone: "11987654321" }}
    />,
  );

  expect(screen.getByLabelText(/Telefone/)).toHaveValue("(11) 98765-4321");
  expect(screen.getByLabelText(/CPF/)).toHaveValue("529.982.247-25");
});

it("prefills the signed-in account e-mail", () => {
  render(
    <CheckoutForm
      cartSummary={{ itemCount: 1, itemsSubtotalInCents: 100 }}
      customerDefaults={{ email: "cliente@exemplo.com.br", taxId: null, phone: null }}
    />,
  );

  expect(screen.getByLabelText(/E-mail/)).toHaveValue("cliente@exemplo.com.br");
});

it("does not put a saved CNPJ in the CPF field", () => {
  render(
    <CheckoutForm
      cartSummary={{ itemCount: 1, itemsSubtotalInCents: 100 }}
      customerDefaults={{ taxId: "11222333000181", phone: null }}
    />,
  );

  expect(screen.getByLabelText(/CPF/)).toHaveValue("");
  expect(screen.getByLabelText(/Telefone/)).toHaveValue("");
});

function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Expected value to be defined");
  return value;
}

it("formats the phone while typing", () => {
  render(<CheckoutForm cartSummary={{ itemCount: 1, itemsSubtotalInCents: 100 }} />);

  fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "11987654321" } });
  expect(screen.getByLabelText("Telefone")).toHaveValue("(11) 98765-4321");
});
