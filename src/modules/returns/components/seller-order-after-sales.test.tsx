import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/config/env", () => ({
  env: {
    IMAGEKIT_PUBLIC_KEY: "public_test",
    IMAGEKIT_PRIVATE_KEY: "private_test",
    IMAGEKIT_URL_ENDPOINT: "https://ik.imagekit.io/example",
  },
}));

import { SellerOrderAfterSales, type SellerOrderAfterSalesData } from "./seller-order-after-sales";

afterEach(cleanup);

const createdAt = new Date("2026-10-14T12:00:00Z");

function buildOrder(overrides: Partial<SellerOrderAfterSalesData>): SellerOrderAfterSalesData {
  return {
    items: [{ id: "item-1", quantity: 1, productNameSnapshot: "Botas Terra Trail", skuSnapshot: "SKU-BOTA" }],
    cancellationRequests: [],
    returnRequests: [],
    disputes: [],
    ...overrides,
  };
}

function blockFor(title: string) {
  const heading = screen.getByRole("heading", { name: title });
  const block = heading.closest("div")?.parentElement;
  if (!block) throw new Error(`Bloco "${title}" não encontrado`);
  return within(block);
}

describe("SellerOrderAfterSales", () => {
  it("renders nothing when the order has no after-sales request", () => {
    const { container } = render(<SellerOrderAfterSales order={buildOrder({})} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("tells the seller an approved cancellation is decided, not still under analysis", () => {
    const order = buildOrder({
      cancellationRequests: [
        { id: "c2", status: "APPROVED", reason: "CUSTOMER_REQUEST", customerMessage: null, createdAt },
      ],
    });
    render(<SellerOrderAfterSales order={order} />);
    const block = blockFor("Cancelamento");

    expect(block.getByText(/Cancelamento aprovado pelo Moto Shop/)).toBeInTheDocument();
    expect(block.queryByText(/enquanto o Moto Shop analisa/)).not.toBeInTheDocument();
  });

  it("shows the open cancellation with reason, items and the do-not-ship warning (UX-13)", () => {
    const order = buildOrder({
      cancellationRequests: [
        { id: "c1", status: "REQUESTED", reason: "CUSTOMER_REQUEST", customerMessage: "Comprei errado", createdAt },
      ],
    });
    render(<SellerOrderAfterSales order={order} />);
    const block = blockFor("Cancelamento");

    expect(block.getByText("Solicitado")).toBeInTheDocument();
    expect(block.getByText("1 × Botas Terra Trail · SKU SKU-BOTA")).toBeInTheDocument();
    expect(block.getByText("Pedido do cliente")).toBeInTheDocument();
    expect(block.getByText('"Comprei errado"')).toBeInTheDocument();
    expect(block.getByText("Não despache este pedido")).toBeInTheDocument();
  });

  it("shows the return with its own items, reason, message and amount (UX-13)", () => {
    const order = buildOrder({
      returnRequests: [
        {
          id: "r1",
          status: "REQUESTED",
          reason: "NOT_AS_DESCRIBED",
          customerMessage: "Furação diferente",
          amountInCents: 32_990,
          createdAt,
          photos: [{ id: "p1", storageKey: "returns/item-1/0b8a8f0e-6c38-4f8e-9f3c-1d2e3f4a5b6c.jpg" }],
          items: [
            { id: "ri-1", quantity: 1, orderItem: { productNameSnapshot: "Disco Onda", skuSnapshot: "SKU-DISCO" } },
          ],
        },
      ],
    });
    render(<SellerOrderAfterSales order={order} />);
    const block = blockFor("Devolução");

    expect(block.getByText("1 × Disco Onda · SKU SKU-DISCO")).toBeInTheDocument();
    expect(block.getByText("Diferente do anúncio")).toBeInTheDocument();
    expect(block.getByText("Furação diferente")).toBeInTheDocument();
    expect(block.getByText(/329,90/)).toBeInTheDocument();
    expect(block.getByText(/acompanha a devolução/)).toBeInTheDocument();
  });

  it("shows the customer's private photos through short-lived signed links", () => {
    const order = buildOrder({
      returnRequests: [
        {
          id: "r1",
          status: "REQUESTED",
          reason: "DAMAGED",
          customerMessage: null,
          amountInCents: 10_000,
          createdAt,
          photos: [{ id: "p1", storageKey: "returns/item-1/0b8a8f0e-6c38-4f8e-9f3c-1d2e3f4a5b6c.jpg" }],
          items: [{ id: "ri-1", quantity: 1, orderItem: { productNameSnapshot: "Disco", skuSnapshot: "SKU-D" } }],
        },
      ],
    });
    render(<SellerOrderAfterSales order={order} />);
    const block = blockFor("Devolução");

    expect(block.getByText("Fotos do cliente (1)")).toBeInTheDocument();
    const link = block.getByRole("link", { name: "Abrir foto 1 em tamanho real" });
    expect(link.getAttribute("href")).toMatch(
      /^https:\/\/ik\.imagekit\.io\/example\/returns\/item-1\/[a-f0-9-]+\.jpg\?ik-t=\d+&ik-s=[a-f0-9]{40}$/,
    );
    expect(block.getByRole("img").getAttribute("src")).toContain("/tr:w-160/returns/item-1/");
  });

  it("shows the open dispute with the customer's report (UX-13)", () => {
    const order = buildOrder({
      disputes: [
        { id: "d1", status: "OPEN", reason: "DELIVERY_PROBLEM", description: "O rastreio não muda", createdAt },
      ],
    });
    render(<SellerOrderAfterSales order={order} />);
    const block = blockFor("Disputa");

    expect(block.getByText("Aberta")).toBeInTheDocument();
    expect(block.getByText("Problema na entrega")).toBeInTheDocument();
    expect(block.getByText("O rastreio não muda")).toBeInTheDocument();
    expect(block.getByText(/faz a mediação/)).toBeInTheDocument();
  });

  it("keeps closed requests with their final status and no next-step text", () => {
    const order = buildOrder({
      cancellationRequests: [
        { id: "c1", status: "REJECTED", reason: "CUSTOMER_REQUEST", customerMessage: null, createdAt },
      ],
      disputes: [{ id: "d1", status: "RESOLVED", reason: "OTHER", description: "Resolvido", createdAt }],
    });
    render(<SellerOrderAfterSales order={order} />);

    expect(blockFor("Cancelamento").getByText("Recusado")).toBeInTheDocument();
    expect(blockFor("Disputa").getByText("Resolvida")).toBeInTheDocument();
    expect(screen.queryByText("Não despache este pedido")).not.toBeInTheDocument();
    expect(screen.queryByText(/faz a mediação/)).not.toBeInTheDocument();
  });

  it("offers no action buttons to the seller (UX-13)", () => {
    const order = buildOrder({
      disputes: [{ id: "d1", status: "OPEN", reason: "OTHER", description: "Ajuda", createdAt }],
    });
    render(<SellerOrderAfterSales order={order} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
