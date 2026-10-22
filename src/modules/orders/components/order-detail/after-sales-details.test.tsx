import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/modules/returns/components/return-photo-gallery", () => ({
  ReturnPhotoGallery: ({ photos, title }: { photos: readonly unknown[]; title: string }) =>
    photos.length ? <p>{`${title} (${photos.length})`}</p> : null,
}));

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

it("shows the customer the photos they attached to the return", () => {
  render(
    <ReturnDetails
      request={{
        status: "REQUESTED",
        reason: "DAMAGED",
        customerMessage: null,
        createdAt: new Date("2026-10-14T12:00:00Z"),
        photos: [{ id: "p1", storageKey: "returns/item-1/0b8a8f0e-6c38-4f8e-9f3c-1d2e3f4a5b6c.jpg" }],
      }}
    />,
  );

  expect(screen.getByText("Suas fotos (1)")).toBeInTheDocument();
});
