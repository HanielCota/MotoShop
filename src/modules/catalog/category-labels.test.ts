import { describe, expect, it } from "vitest";

import { getCategoryOptionLabel, sortCategoriesByOptionLabel } from "./category-labels";

const parts = { slug: "parts", name: "Parts" };
const equipment = { slug: "equipment", name: "Equipment" };
const helmets = { slug: "equipment-helmets", name: "Helmets", parent: equipment };
const partsRoot = { ...parts, parent: null };
const categories = [
  helmets,
  { slug: "parts-engine", name: "Engine", parent: parts },
  partsRoot,
  { slug: "equipment-boots", name: "Boots", parent: equipment },
  { ...equipment, parent: null },
  { slug: "apparel", name: "Apparel", parent: null },
  { slug: "parts-brakes", name: "Brakes", parent: parts },
];

describe("category option labels", () => {
  it("prefixes subcategories with their parent label", () => {
    expect(getCategoryOptionLabel(helmets)).toBe("Equipamentos / Capacetes");
    expect(getCategoryOptionLabel(partsRoot)).toBe("Peças");
  });

  it("sorts by the displayed Portuguese label, keeping subcategories after their parent", () => {
    expect(sortCategoriesByOptionLabel(categories).map(getCategoryOptionLabel)).toEqual([
      "Equipamentos",
      "Equipamentos / Botas",
      "Equipamentos / Capacetes",
      "Peças",
      "Peças / Freios",
      "Peças / Motor",
      "Vestuário",
    ]);
  });

  it("does not mutate the original list", () => {
    const original = [...categories];
    sortCategoriesByOptionLabel(categories);
    expect(categories).toEqual(original);
  });
});
