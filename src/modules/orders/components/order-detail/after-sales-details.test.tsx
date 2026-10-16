import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { DisputeDetails, ReturnDetails } from "./after-sales-details";

afterEach(cleanup);

it("shows the customer what they reported in an open dispute and the next step", () => {
  render(
    <DisputeDetails
      dispute={{
        status: "OPEN",
        reason: "ITEM_PROBLEM",
        description: "O capacete chegou com a viseira riscada.",
        createdAt: new Date("2026-10-05T12:00:00Z"),
      }}
    />,
  );

  expect(screen.getByText("Problema com o item")).toBeInTheDocument();
  expect(screen.getByText("O capacete chegou com a viseira riscada.")).toBeInTheDocument();
  expect(screen.getByText(/O que acontece agora:/)).toBeInTheDocument();
});

it("drops the next step once the dispute is closed", () => {
  render(
    <DisputeDetails
      dispute={{ status: "RESOLVED", reason: "OTHER", description: "Relato", createdAt: new Date("2026-10-05") }}
    />,
  );

  expect(screen.queryByText(/O que acontece agora:/)).not.toBeInTheDocument();
});

it("shows the return reason and the customer's own message", () => {
  render(
    <ReturnDetails
      request={{
        status: "REQUESTED",
        reason: "DAMAGED",
        customerMessage: "Chegou quebrado.",
        createdAt: new Date("2026-10-06T12:00:00Z"),
      }}
    />,
  );

  expect(screen.getByText("Produto danificado")).toBeInTheDocument();
  expect(screen.getByText("Chegou quebrado.")).toBeInTheDocument();
});
