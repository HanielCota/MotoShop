import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { FormMessage } from "./form-message";

afterEach(cleanup);

it("announces errors in a box by default", () => {
  render(<FormMessage error="Falhou." />);

  expect(screen.getByRole("alert")).toHaveAttribute("data-slot", "inline-notice");
});

it("renders plain inline text with the same roles", () => {
  render(<FormMessage variant="inline" error="Falhou." />);
  expect(screen.getByRole("alert")).toHaveClass("text-destructive");
  cleanup();

  render(<FormMessage variant="inline" success="Salvo." />);
  expect(screen.getByRole("status")).toHaveClass("text-success-foreground");
});

it("renders nothing without a message", () => {
  const { container } = render(<FormMessage variant="inline" />);

  expect(container).toBeEmptyDOMElement();
});
