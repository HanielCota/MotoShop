import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { pageContainerClassName } from "./page-container";
import { PageSkeleton } from "./skeleton";

afterEach(cleanup);

it("uses the storefront width by default and the Admin width when wide", () => {
  expect(pageContainerClassName()).toContain("max-w-6xl");
  expect(pageContainerClassName("wide", "py-8")).toContain("max-w-7xl");
  expect(pageContainerClassName("wide", "py-8")).toContain("py-8");
});

it("keeps the page skeleton at the width of the page it stands in for", () => {
  render(<PageSkeleton label="Carregando pedidos" />);

  expect(screen.getByRole("status", { name: "Carregando pedidos" })).toHaveClass("max-w-6xl");
});
