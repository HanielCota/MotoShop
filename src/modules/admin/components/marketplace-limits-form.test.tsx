import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ update: vi.fn(), refresh: vi.fn() }));
vi.mock("../actions/marketplace-configuration-actions", () => ({ updateMarketplaceLimitsAction: mocks.update }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { marketplaceLimitsFormValues } from "../schemas/marketplace-limits";
import { MarketplaceLimitsForm } from "./marketplace-limits-form";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

function renderForm() {
  return render(<MarketplaceLimitsForm defaultValues={marketplaceLimitsFormValues(null)} />);
}

it("opens blank, with today's value shown inside each field and the accepted range below it", () => {
  renderForm();

  const photos = screen.getByLabelText("Fotos por produto");

  expect(photos).toHaveValue("");
  expect(photos).toHaveAttribute("placeholder", "8");
  expect(screen.getByText("De 1 a 12. Quem já tem mais fotos não perde nenhuma.")).toBeInTheDocument();
});

it("sends the typed fields for the server to validate again and refreshes the page", async () => {
  mocks.update.mockResolvedValue({ success: "Limites atualizados." });
  renderForm();

  fireEvent.change(screen.getByLabelText("Fotos por pedido de devolução"), { target: { value: "5" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar limites" }));

  await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ returnPhotoLimit: "5", productPhotoLimit: "" }));
});

it("points to the wrong field in Portuguese without calling the server", async () => {
  renderForm();

  fireEvent.change(screen.getByLabelText("Validade do convite da equipe (dias)"), { target: { value: "40" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar limites" }));

  expect(await screen.findByText(/use um número inteiro de 1 a 30/)).toBeInTheDocument();
  expect(screen.getByLabelText("Validade do convite da equipe (dias)")).toHaveAttribute("aria-invalid", "true");
  expect(mocks.update).not.toHaveBeenCalled();
});
