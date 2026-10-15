import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { StatusBadge } from "./status-badge";

afterEach(cleanup);

function iconOf(text: string) {
  const badge = screen.getByText(text).closest("[data-status]");
  return badge?.querySelector("svg")?.getAttribute("class") ?? "";
}

it("picks the icon by meaning, not by color", () => {
  render(
    <>
      <StatusBadge domain="order" status="PAID" />
      <StatusBadge domain="order" status="PENDING_PAYMENT" />
      <StatusBadge domain="return" status="RETURNED" />
      <StatusBadge domain="order" status="CANCELLED" />
    </>,
  );

  expect(iconOf("Pago")).toContain("lucide-check");
  expect(iconOf("Aguardando pagamento")).toContain("lucide-clock");
  expect(iconOf("Recebida pela loja")).toContain("lucide-check");
  expect(iconOf("Cancelado")).toContain("lucide-circle-x");
});

it("shows the same icon for the same label across domains", () => {
  render(
    <>
      <StatusBadge domain="product" status="SUBMITTED" label="Produto em análise" />
      <StatusBadge domain="return" status="UNDER_REVIEW" label="Devolução em análise" />
    </>,
  );

  expect(iconOf("Produto em análise")).toContain("lucide-clock");
  expect(iconOf("Devolução em análise")).toContain("lucide-clock");
});
