import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { Badge } from "./badge";

afterEach(cleanup);

it("offers an inverse variant for dark pills on light surfaces", () => {
  render(<Badge variant="inverse">Novidade</Badge>);

  expect(screen.getByText("Novidade")).toHaveClass("bg-foreground", "text-background");
});
