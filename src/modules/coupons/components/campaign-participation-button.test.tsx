import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ join: vi.fn(), leave: vi.fn() }));
vi.mock("../actions/coupon-actions", () => ({
  joinMarketplaceCouponAction: mocks.join,
  leaveMarketplaceCouponAction: mocks.leave,
}));

import { CampaignParticipationButton } from "./campaign-participation-button";

const campaignId = "cmf8w8m4p0000s6o5zj2q8v3k";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("joins a campaign and shows the confirmation", async () => {
  mocks.join.mockResolvedValue({ success: "Sua loja entrou na campanha." });
  render(<CampaignParticipationButton couponId={campaignId} joined={false} />);

  fireEvent.click(screen.getByRole("button", { name: "Entrar na campanha" }));

  expect(await screen.findByRole("status")).toHaveTextContent("Sua loja entrou na campanha.");
  expect(mocks.join).toHaveBeenCalledWith(campaignId);
  expect(mocks.leave).not.toHaveBeenCalled();
});

it("leaves a joined campaign and shows the domain error when it fails", async () => {
  mocks.leave.mockResolvedValue({ error: "Esta campanha não está mais disponível para adesão." });
  render(<CampaignParticipationButton couponId={campaignId} joined />);

  fireEvent.click(screen.getByRole("button", { name: "Sair da campanha" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("não está mais disponível");
  expect(mocks.leave).toHaveBeenCalledWith(campaignId);
});
