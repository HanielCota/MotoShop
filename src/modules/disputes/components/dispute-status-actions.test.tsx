import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ review: vi.fn() }));
vi.mock("../actions/admin-dispute-actions", () => ({ reviewDisputeAction: mocks.review }));

import { DisputeStatusActions } from "./dispute-status-actions";

beforeEach(() => {
  mocks.review.mockReset();
  mocks.review.mockResolvedValue({ success: "Disputa resolvida." });
});
afterEach(cleanup);

const summary = { orderNumber: "MS-REVIEW-0004", storeName: "Garagem MX" };

it("requires a resolution before closing a dispute (BUG-002)", async () => {
  render(<DisputeStatusActions disputeId="cdispute0001" status="UNDER_REVIEW" summary={summary} />);

  fireEvent.click(screen.getByRole("button", { name: "Resolver" }));
  fireEvent.click((await screen.findAllByRole("button", { name: "Resolver" })).at(-1) as HTMLElement);

  expect(await screen.findByText("Informe o motivo para continuar.")).toBeInTheDocument();
  expect(mocks.review).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText("Resolução"), { target: { value: "Loja reenviou o produto certo." } });
  fireEvent.click(screen.getAllByRole("button", { name: "Resolver" }).at(-1) as HTMLElement);

  expect(await screen.findByText("Disputa resolvida.")).toBeInTheDocument();
  const formData = mocks.review.mock.calls[0]?.[1];
  expect(formData.get("decision")).toBe("RESOLVE");
  expect(formData.get("note")).toBe("Loja reenviou o produto certo.");
});
