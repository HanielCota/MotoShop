import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

type Rgb = [number, number, number];

const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");

function token(name: string): Rgb {
  const match = new RegExp(String.raw`--${name}: oklch\(([\d.]+) ([\d.]+) ([\d.]+)\);`).exec(css);
  if (!match) throw new Error(`Token --${name} not found as oklch()`);

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** OKLCH → linear sRGB (Björn Ottosson's matrices); out-of-gamut values fail the test. */
function linearSrgb([lightness, chroma, hue]: Rgb): Rgb {
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const encode = (value: number) => (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055);
const decode = (value: number) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);

function srgb(color: Rgb): Rgb {
  const [red, green, blue] = linearSrgb(color);
  return [encode(red), encode(green), encode(blue)];
}

function luminance([red, green, blue]: Rgb): number {
  return 0.2126 * decode(red) + 0.7152 * decode(green) + 0.0722 * decode(blue);
}

function over(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return [0, 1, 2].map((index) => foreground[index] * alpha + background[index] * (1 - alpha)) as Rgb;
}

function contrast(first: Rgb, second: Rgb): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("--destructive token", () => {
  const destructive = token("destructive");

  it("stays inside sRGB so every browser renders the same red", () => {
    for (const channel of linearSrgb(destructive)) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
  });

  it.each(["background", "card", "muted"])("keeps 4.5:1 for destructive text on its tints over --%s", (surface) => {
    const text = srgb(destructive);
    const base = srgb(token(surface));

    expect(contrast(text, base)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(text, over(text, base, 0.1))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(text, over(text, base, 0.2))).toBeGreaterThanOrEqual(4.5);
  });
});
