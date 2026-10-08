import { describe, expect, it, vi } from "vitest";

vi.mock("../actions/saved-motorcycle-actions", () => ({ savePrimaryMotorcycleFromProductAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

import { withMotoParam } from "./product-motorcycle-picker";

describe("withMotoParam", () => {
  it("sets the motorcycle while preserving review/question params", () => {
    expect(withMotoParam("/products/x?reviewPage=2", "fit1")).toBe("/products/x?reviewPage=2&moto=fit1");
  });

  it("replaces or removes an existing motorcycle", () => {
    expect(withMotoParam("/products/x?moto=old", "new")).toBe("/products/x?moto=new");
    expect(withMotoParam("/products/x?moto=old&reviewPage=2", null)).toBe("/products/x?reviewPage=2");
    expect(withMotoParam("/products/x", null)).toBe("/products/x");
  });
});
