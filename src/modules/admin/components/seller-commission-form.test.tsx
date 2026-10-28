import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../actions/seller-commission-actions", () => ({ updateSellerCommissionAction: vi.fn() }));

import { describeSellerCommission, SellerCommissionForm } from "./seller-commission-form";

describe("describeSellerCommission", () => {
  it.each([
    [null, 500, "padrão do marketplace (5%)"],
    [1000, 500, "10% (desta loja)"],
    [0, 500, "0% (desta loja)"],
    [null, null, "padrão do marketplace"],
  ])("describes override %s with default %s as %s", (override, defaultBps, expected) => {
    expect(describeSellerCommission(override, defaultBps)).toBe(expected);
  });
});

it("shows the commission as one line and keeps the form closed until Alterar", () => {
  render(<SellerCommissionForm sellerId="seller-1" commissionBpsOverride={null} defaultCommissionBps={500} />);

  expect(screen.getByText("padrão do marketplace (5%)")).toBeVisible();
  expect(screen.getByText("Alterar")).toBeInTheDocument();
  expect(screen.getByRole("group", { hidden: true }).closest("details")).not.toHaveAttribute("open");
});
