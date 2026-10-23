import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({ default: () => null }));

import { pixPaymentMethod } from "./payment-method-icons";

// Bounds of the Pix symbol (the three diamonds) inside pix.svg, measured in the browser with getBBox.
const pixSymbolBounds = { minX: 0, maxX: 78.52, minY: 5.75, maxY: 84.26 };

async function readPixViewBox(): Promise<number[]> {
  const svg = await readFile(path.join(process.cwd(), "public/images/payment-methods/pix.svg"), "utf8");
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1];
  if (viewBox == null) throw new Error("pix.svg has no viewBox");

  return viewBox.trim().split(/\s+/).map(Number);
}

describe("Pix mark", () => {
  it("frames the whole symbol in a square, so no tip is cut in the footer or the checkout", async () => {
    const [minX = Number.NaN, minY = Number.NaN, width = Number.NaN, height = Number.NaN] = await readPixViewBox();

    expect(width).toBeCloseTo(height, 1);
    expect(minX).toBeLessThanOrEqual(pixSymbolBounds.minX);
    expect(minY).toBeLessThanOrEqual(pixSymbolBounds.minY);
    expect(minX + width).toBeGreaterThanOrEqual(pixSymbolBounds.maxX);
    expect(minY + height).toBeGreaterThanOrEqual(pixSymbolBounds.maxY);
  });

  it("is drawn in a square box, with the same proportion as its frame", () => {
    expect(pixPaymentMethod.width).toBe(pixPaymentMethod.height);
  });
});
