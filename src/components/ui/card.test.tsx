import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { Card, CardContent, CardHeader, CardTitle } from "./card";

afterEach(cleanup);

it("draws a border instead of a ring and keeps the slot and size the styles depend on (DS-10)", () => {
  render(
    <Card size="sm" data-testid="card">
      <CardHeader>
        <CardTitle>Seus dados</CardTitle>
      </CardHeader>
      <CardContent>Conteúdo</CardContent>
    </Card>,
  );

  const card = screen.getByTestId("card");
  expect(card.tagName).toBe("DIV");
  expect(card).toHaveAttribute("data-slot", "card");
  expect(card).toHaveAttribute("data-size", "sm");
  expect(card).toHaveClass("border", "border-border", "rounded-xl");
  expect(card.className).not.toMatch(/\bring-1\b/);
  expect(screen.getByRole("heading", { level: 2, name: "Seus dados" })).toBeInTheDocument();
});

it("keeps the semantics of the block it replaces through render", () => {
  render(
    <Card render={<section aria-labelledby="store-title" />} className="p-4">
      <h2 id="store-title">Garagem MX</h2>
    </Card>,
  );

  const section = screen.getByRole("region", { name: "Garagem MX" });
  expect(section.tagName).toBe("SECTION");
  expect(section).toHaveAttribute("data-slot", "card");
  expect(section).toHaveClass("p-4", "border");
});
