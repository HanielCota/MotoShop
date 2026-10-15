import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { DateFilterInput } from "./date-filter-input";

afterEach(cleanup);

it("has no native pattern or title tooltip", () => {
  render(<DateFilterInput name="from" />);
  const field = screen.getByPlaceholderText("dd/mm/aaaa");

  expect(field).not.toHaveAttribute("pattern");
  expect(field).not.toHaveAttribute("title");
});

it("flags a value that is not a date inline", () => {
  render(<DateFilterInput name="from" value="31/02/2026" />);
  const field = screen.getByPlaceholderText("dd/mm/aaaa");

  expect(field).toHaveAttribute("aria-invalid", "true");
  expect(field).toHaveAccessibleDescription(/Data inválida/);
});
