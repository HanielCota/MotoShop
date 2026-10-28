import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ review: vi.fn() }));
vi.mock("../actions/admin-cancellation-actions", () => ({ reviewCancellationRequestAction: mocks.review }));

import { CancellationStatusActions } from "./cancellation-status-actions";

beforeEach(() => {
  mocks.review.mockReset();
  mocks.review.mockResolvedValue({ success: "Cancelamento aprovado e reembolso solicitado." });
});
afterEach(cleanup);

const summary = { orderNumber: "MS-REVIEW-C2-0006", storeName: "Garagem MX", amountInCents: 15990 };

it("asks for confirmation with order, store and amount before refunding (BUG-002)", async () => {
  render(<CancellationStatusActions cancellationRequestId="ccancel0001" status="REQUESTED" summary={summary} />);

  fireEvent.click(screen.getByRole("button", { name: "Aprovar e reembolsar" }));

  expect(await screen.findByText("MS-REVIEW-C2-0006")).toBeInTheDocument();
  expect(screen.getByText(/159,90/)).toBeInTheDocument();
  expect(mocks.review).not.toHaveBeenCalled();

  fireEvent.click(screen.getAllByRole("button", { name: "Aprovar e reembolsar" }).at(-1) as HTMLElement);

  expect(await screen.findByText("Cancelamento aprovado e reembolso solicitado.")).toBeInTheDocument();
  expect(mocks.review.mock.calls[0]?.[1].get("decision")).toBe("APPROVE");
});

it("offers Recusar while the request still waits for a decision", () => {
  render(<CancellationStatusActions cancellationRequestId="ccancel0001" status="REQUESTED" summary={summary} />);

  expect(screen.getByRole("button", { name: "Recusar" })).toBeInTheDocument();
});

it("hides Recusar once the cancellation was approved, since the server no longer accepts it", () => {
  render(<CancellationStatusActions cancellationRequestId="ccancel0001" status="APPROVED" summary={summary} />);

  expect(screen.getByRole("button", { name: "Continuar processamento" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Recusar" })).not.toBeInTheDocument();
});
