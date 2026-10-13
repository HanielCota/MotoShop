import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ activate: vi.fn() }));
vi.mock("../actions/admin-subscription-actions", () => ({ activateVipSubscriptionAction: mocks.activate }));

import { VipSubscriptionForm } from "./vip-subscription-form";

afterEach(cleanup);

it("keeps the chosen store and duration when the server refuses the activation", async () => {
  mocks.activate.mockResolvedValue({ error: "Loja não encontrada ou indisponível." });
  render(
    <VipSubscriptionForm
      sellers={[
        { id: "seller-a", name: "Loja A", hasActiveVip: false },
        { id: "seller-b", name: "Loja B", hasActiveVip: false },
      ]}
    />,
  );

  fireEvent.change(screen.getByLabelText("Lojista"), { target: { value: "seller-b" } });
  fireEvent.change(screen.getByLabelText("Duração"), { target: { value: "6" } });
  fireEvent.click(screen.getByRole("button", { name: "Ativar VIP" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Loja não encontrada");
  expect(screen.getByLabelText("Lojista")).toHaveValue("seller-b");
  expect(screen.getByLabelText("Duração")).toHaveValue("6");
});
