import { describe, expect, it } from "vitest";

import { accountAreaShortcuts } from "./account-area-shortcuts";

describe("account area shortcuts", () => {
  it("gives a customer no shortcut", () => {
    expect(accountAreaShortcuts({ admin: false, seller: false })).toEqual([]);
  });

  it("lists the Admin before the Central do Lojista for someone who has both", () => {
    expect(accountAreaShortcuts({ admin: true, seller: true }).map((shortcut) => shortcut.href)).toEqual([
      "/admin",
      "/seller",
    ]);
  });

  it("gives a store member only the Central do Lojista", () => {
    expect(accountAreaShortcuts({ admin: false, seller: true })).toEqual([
      { area: "seller", href: "/seller", label: "Central do Lojista" },
    ]);
  });
});
