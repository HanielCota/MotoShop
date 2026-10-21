import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { SellerStatsSkeleton } from "./seller-card-skeleton";

it("draws only the indicator placeholders the role will see, with no empty columns", () => {
  render(<SellerStatsSkeleton items={1} />);

  const skeleton = screen.getByRole("status", { name: "Carregando indicadores" });

  expect(skeleton).toHaveClass("grid", "gap-3");
  expect(skeleton.className).not.toContain("lg:grid-cols-4");
});
