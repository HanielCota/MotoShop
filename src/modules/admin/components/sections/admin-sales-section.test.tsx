import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: {} }));

import { AdminSalesSection } from "./admin-sales-section";

afterEach(cleanup);

it("keeps the payout store search when the period changes, back on page 1", async () => {
  // Custom period without dates: the section renders its filters and no figures, so nothing reads the database.
  const searchParams = Promise.resolve({ salesPeriod: "custom", payoutQ: "Trilha", payoutPage: "2" });

  render(await AdminSalesSection({ searchParams }));

  expect(screen.getByRole("link", { name: "Mês atual" })).toHaveAttribute(
    "href",
    "/admin/sales?salesPeriod=month&payoutQ=Trilha",
  );
  const dateForm = screen.getByRole("form", { name: "Escolher datas" });
  expect(dateForm.querySelector('input[type="hidden"][name="payoutQ"]')).toHaveValue("Trilha");
  expect(dateForm.querySelector('input[name="payoutPage"]')).toBeNull();
});
