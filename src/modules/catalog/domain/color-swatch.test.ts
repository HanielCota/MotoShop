import { describe, expect, it } from "vitest";

import { colorSwatchBackground } from "./color-swatch";

describe("colorSwatchBackground", () => {
  it("reads the tone from the first word, ignoring case, accents and the feminine form", () => {
    expect(colorSwatchBackground("Preto")).toBe("#111111");
    expect(colorSwatchBackground("Preta")).toBe("#111111");
    expect(colorSwatchBackground("Preto fosco")).toBe("#111111");
    expect(colorSwatchBackground("DOURADA")).toBe("#c9a227");
    expect(colorSwatchBackground("Cinza fosco")).toBe("#8a8d91");
  });

  it("splits a two-color name diagonally", () => {
    expect(colorSwatchBackground("Azul/amarelo")).toBe("linear-gradient(135deg, #1f5bd8 50%, #f5c400 50%)");
    expect(colorSwatchBackground("Preta/laranja")).toBe("linear-gradient(135deg, #111111 50%, #ff6a00 50%)");
  });

  it("shows no swatch when a part has no known tone", () => {
    expect(colorSwatchBackground("Camuflado")).toBeNull();
    expect(colorSwatchBackground("Preto/neon")).toBeNull();
    expect(colorSwatchBackground("")).toBeNull();
    expect(colorSwatchBackground("Azul/preto/branco")).toBeNull();
  });
});
