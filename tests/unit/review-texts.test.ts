import { describe, expect, it } from "vitest";

import {
  DEMO_CATALOG_PRODUCT_DESCRIPTIONS,
  DEMO_MARKER,
  DEMO_STORE_DESCRIPTIONS,
  changedFields,
  cleanOptionalText,
  cleanProductDescription,
  demoStoreDescription,
  isSameDemoName,
  stillMarkedFields,
  withoutDemoMarkers,
} from "../../scripts/review-texts";

describe("withoutDemoMarkers", () => {
  it("drops the markers the seeds appended to stores, products, brands and image texts", () => {
    expect(withoutDemoMarkers("Garagem MX · demonstração")).toBe("Garagem MX");
    expect(withoutDemoMarkers("Capacete off-road Apex Pro (demonstração)")).toBe("Capacete off-road Apex Pro");
    expect(withoutDemoMarkers("Marca Pista (demonstração)")).toBe("Marca Pista");
    expect(withoutDemoMarkers("Garagem MX Demonstração")).toBe("Garagem MX");
    expect(withoutDemoMarkers("Capacete Apex Pro (demonstração) · Vista lateral")).toBe(
      "Capacete Apex Pro · Vista lateral",
    );
  });

  it("keeps names without a marker as they are", () => {
    expect(withoutDemoMarkers("Conjunto infantil Mini MX (camisa + calça)")).toBe(
      "Conjunto infantil Mini MX (camisa + calça)",
    );
    expect(cleanOptionalText(null)).toBeNull();
  });
});

describe("cleanProductDescription", () => {
  // Regression: the live demo showed "Produto fictício criado para revisão visual do O Moto Shop; ...",
  // a wording older than the seed's, so the cleanup cannot match the notice word for word.
  it("drops the fictitious-product notice in the seed's and the older wording", () => {
    const body = "Capacete off-road com casco em fibra composta.";
    expect(
      cleanProductDescription(
        "review-capacete-apex-pro",
        `${body} Produto fictício criado para revisão visual do Moto Shop; preço, estoque e compatibilidade são ilustrativos.`,
      ),
    ).toBe(body);
    expect(
      cleanProductDescription(
        "review-capacete-apex-pro",
        `${body} Produto fictício criado para revisão visual do O Moto Shop; preço, estoque e compatibilidade são ilustrativos.`,
      ),
    ).toBe(body);
  });

  it("replaces the catalog seed's descriptions, whose notice sits mid-text", () => {
    expect(
      cleanProductDescription("demo-disco-de-freio-onda", "Disco demonstrativo. Não há produto físico à venda."),
    ).toBe(DEMO_CATALOG_PRODUCT_DESCRIPTIONS["demo-disco-de-freio-onda"]);
  });
});

it("writes store and product texts without any demo marker", () => {
  const texts = [...Object.values(DEMO_STORE_DESCRIPTIONS), ...Object.values(DEMO_CATALOG_PRODUCT_DESCRIPTIONS)];
  expect(texts.filter((text) => DEMO_MARKER.test(text))).toEqual([]);
  expect(() => demoStoreDescription("review-loja-desconhecida")).toThrow("review-loja-desconhecida");
});

it("lets the seeds recognise a store they created under the old or the new name", () => {
  expect(isSameDemoName("Garagem MX · demonstração", "Garagem MX")).toBe(true);
  expect(isSameDemoName("Garagem MX", "Garagem MX")).toBe(true);
  expect(isSameDemoName("Garagem Real", "Garagem MX")).toBe(false);
});

it("plans only the fields that change and reports the ones still marked", () => {
  const row = {
    table: "Store",
    id: "store-1",
    label: "review-garagem-mx",
    fields: [
      { field: "name", current: "Garagem MX · demonstração", next: "Garagem MX" },
      { field: "originName", current: null, next: null },
      { field: "description", current: "Dados ilustrativos.", next: "Dados ilustrativos." },
    ],
  };

  expect(changedFields(row).map((field) => field.field)).toEqual(["name"]);
  expect(stillMarkedFields(row).map((field) => field.field)).toEqual(["description"]);
});
