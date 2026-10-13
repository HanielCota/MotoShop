import { describe, expect, it } from "vitest";

import { buildVariantAttributesSnapshot } from "./variant-attributes";

describe("buildVariantAttributesSnapshot", () => {
  it("adds gender, color and size next to the free-form attributes", () => {
    expect(
      buildVariantAttributesSnapshot({ material: "Couro" }, { gender: "FEMALE", color: "Preto", size: "M" }),
    ).toEqual({ material: "Couro", gender: "FEMALE", color: "Preto", size: "M" });
  });

  it("only records the structured attributes the variant has", () => {
    expect(buildVariantAttributesSnapshot({}, { gender: null, color: "Azul", size: null })).toEqual({ color: "Azul" });
  });

  it("keeps the previous snapshot when the variant has no structured attributes", () => {
    const attributes = { material: "Nylon" };
    expect(buildVariantAttributesSnapshot(attributes, { gender: null, color: null, size: null })).toBe(attributes);
  });

  it("starts from an empty object when the free-form attributes are not an object", () => {
    expect(buildVariantAttributesSnapshot(null, { gender: "UNISEX", color: null, size: null })).toEqual({
      gender: "UNISEX",
    });
  });
});
