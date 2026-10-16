import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { FilterDateRange } from "./filter-form";

afterEach(cleanup);

it("warns when the start date comes after the end date (BUG-012)", () => {
  render(<FilterDateRange fromName="from" toName="to" from="31/10/2026" to="01/10/2026" />);

  expect(screen.getByText(/A data inicial \(31\/10\/2026\) é depois da final \(01\/10\/2026\)/)).toBeInTheDocument();
});

it("stays quiet for a valid or open period", () => {
  render(<FilterDateRange fromName="from" toName="to" from="01/10/2026" to={null} />);

  expect(screen.queryByText(/é depois da final/)).not.toBeInTheDocument();
});
