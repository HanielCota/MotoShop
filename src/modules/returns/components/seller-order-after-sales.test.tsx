import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

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
