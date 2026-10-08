import { describe, expect, it } from "vitest";

import { formatCount } from "./format";

describe("formatCount", () => {
  it("uses the singular only for exactly one", () => {
    expect(formatCount(1, "pedido", "pedidos")).toBe("1 pedido");
    expect(formatCount(0, "pedido", "pedidos")).toBe("0 pedidos");
    expect(formatCount(2, "item", "itens")).toBe("2 itens");
  });

  it("groups thousands the Brazilian way", () => {
    expect(formatCount(1250, "evento", "eventos")).toBe("1.250 eventos");
  });
});
