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

it("lays a section card out in block flow so buttons and inline children keep their own width", () => {
  render(
    <Card size="section" render={<form />} data-testid="section-card">
      <button type="submit">Enviar pergunta</button>
    </Card>,
  );

  const card = screen.getByTestId("section-card");
  expect(card.tagName).toBe("FORM");
  expect(card).toHaveAttribute("data-size", "section");
  expect(card).toHaveClass("block", "p-4", "sm:p-6", "text-base", "overflow-visible", "border");
  for (const replaced of ["flex", "overflow-hidden", "py-(--card-spacing)", "text-sm"]) {
    expect(card).not.toHaveClass(replaced);
  }
});

it("lets a section card become a grid when the block needs one", () => {
  render(<Card size="section" render={<form />} className="grid gap-4" data-testid="grid-card" />);

  const card = screen.getByTestId("grid-card");
  expect(card).toHaveClass("grid", "gap-4");
  expect(card).not.toHaveClass("block");
  expect(card).not.toHaveClass("gap-0");
});
