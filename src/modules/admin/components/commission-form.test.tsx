import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("../actions/marketplace-configuration-actions", () => ({ updateMarketplaceCommissionAction: mocks.update }));

import { CommissionForm } from "./commission-form";

afterEach(cleanup);

it("keeps the typed percentage when the server refuses it", async () => {
  mocks.update.mockImplementation(async (_state: unknown, formData: FormData) => ({
    error: "Informe uma comissão entre 0% e 100%.",
    values: { commissionPercent: String(formData.get("commissionPercent")) },
  }));
  render(<CommissionForm defaultCommissionBps={1200} />);

  fireEvent.change(screen.getByLabelText("Comissão padrão (%)"), { target: { value: "150" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar comissão" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Informe uma comissão");
  expect(screen.getByLabelText("Comissão padrão (%)")).toHaveValue("150");
});
