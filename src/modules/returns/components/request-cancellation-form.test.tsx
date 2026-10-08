import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/modules/returns/actions/cancellation-actions", () => ({ requestCancellationAction: mocks.request }));

import { RequestCancellationForm } from "./request-cancellation-form";

afterEach(() => {
  cleanup();
  mocks.request.mockReset();
});

it("does not submit cancellation when the dialog is dismissed", () => {
  render(<RequestCancellationForm orderNumber="MS-TEST" sellerOrderId="seller-order" />);
  fireEvent.click(screen.getByRole("button", { name: "Solicitar cancelamento" }));
  expect(screen.getByRole("dialog", { name: "Solicitar cancelamento" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
  expect(mocks.request).not.toHaveBeenCalled();
});
