import { describe, expect, it } from "vitest";

import { inferVariantColumns, inferVariantGender } from "../../scripts/review-seed-variant-attributes";

describe("inferVariantGender", () => {
  it.each([
    ["Calça de motocross feminina Trilha", "FEMALE"],
    ["Jaqueta Masculina Enduro", "MALE"],
    ["Luvas masculinos", "MALE"],
    ["Capacete infantil Mini", "UNISEX"],
    ["Bota off-road Terra", "UNISEX"],
  ] as const)("%s → %s", (name, gender) => {
    expect(inferVariantGender(name)).toBe(gender);
  });
});

describe("inferVariantColumns", () => {
  it("copies color and size from the seed attributes", () => {
    expect(
      inferVariantColumns({
        productName: "Camisa off-road (demonstração)",
        attributes: { cor: "Preto/laranja", tamanho: "M" },
      }),
    ).toEqual({ gender: "UNISEX", color: "Preto/laranja", size: "M" });
  });

  it("keeps the missing one empty", () => {
    expect(
      inferVariantColumns({ productName: "Óculos Vista", attributes: { cor: " Azul ", lente: "Espelhada" } }),
    ).toEqual({
      gender: "UNISEX",
      color: "Azul",
      size: null,
    });
  });

  it.each([{ kit: "Completo" }, {}, null, "texto", { cor: "", tamanho: 42 }])(
    "leaves parts without color or size untouched (%j)",
    (attributes) => {
      expect(inferVariantColumns({ productName: "Corrente 520", attributes })).toBeNull();
    },
  );

  it("caps long values at the column limit", () => {
    const columns = inferVariantColumns({ productName: "Camisa", attributes: { cor: "x".repeat(80) } });
    expect(columns?.color).toHaveLength(50);
  });
});
