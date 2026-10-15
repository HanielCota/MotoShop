import { expect, it } from "vitest";

import { buttonVariants } from "./button";

it("styles standalone text links with a 44px touch target on phones and no padding", () => {
  const classes = buttonVariants({ variant: "link", size: "link" }).split(" ");

  expect(classes).toEqual(
    expect.arrayContaining(["text-brand-text", "underline", "min-h-11", "sm:min-h-9", "px-0", "w-fit"]),
  );
  expect(classes).not.toContain("h-11");
});

it("offers a muted link and a small one for dense tables", () => {
  expect(buttonVariants({ variant: "link-muted", size: "link" })).toContain("text-muted-foreground");
  expect(buttonVariants({ variant: "link", size: "link-xs" })).toContain("text-xs");
});
