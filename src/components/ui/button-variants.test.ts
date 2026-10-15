import { expect, it } from "vitest";

import { buttonVariants } from "./button";

it("keeps the outline border when buttonVariants is used without cn()", () => {
  const classes = buttonVariants({ variant: "outline" }).split(" ");

  expect(classes).toContain("border-border");
  expect(classes).not.toContain("border-transparent");
});

it("lets a caller className override the size classes", () => {
  const classes = buttonVariants({ size: "lg", className: "h-14" }).split(" ");

  expect(classes).toContain("h-14");
  expect(classes).not.toContain("h-12");
});
