import { describe, expect, it } from "vitest";

import { buildShipmentData, carrierAcceptsMultipleVolumes, volumesFromQuotedPackages } from "./shipment-payload";

const store = {
  originName: "Loja",
  originEmail: "loja@example.test",
  originPhone: "11999999999",
  originDocument: "12345678901",
  originPostalCode: "01001000",
  originStreet: "Rua A",
  originNumber: "10",
  originComplement: null,
  originNeighborhood: "Centro",
  originCity: "São Paulo",
  originState: "SP",
  originStateRegister: null,
};

describe("buildShipmentData", () => {
  it("sends phones saved before the mask as digits only, like the Melhor Envio examples", () => {
    const data = buildShipmentData({
      seller: { type: "INDIVIDUAL" },
      store: { ...store, originPhone: "(11) 99999-9999" },
      order: {
        customerName: "Cliente",
        customerEmail: "cliente@example.test",
        customerPhone: "(11) 98888-7777",
        customerTaxId: null,
        shippingAddress: {
          street: "Rua B",
          number: "20",
          complement: null,
          neighborhood: "Centro",
          city: "São Paulo",
          postalCode: "01310000",
          country: "BR",
          state: "SP",
        },
      },
      items: [],
    });

    expect(data.from.phone).toBe("11999999999");
    expect(data.to.phone).toBe("11988887777");
  });

  it("sends unit insurance per product and the total insured value of the shipment", () => {
    const data = buildShipmentData({
      seller: { type: "INDIVIDUAL" },
      store,
      order: {
        customerName: "Cliente",
        customerEmail: "cliente@example.test",
        customerPhone: "11988887777",
        customerTaxId: null,
        shippingAddress: {
          street: "Rua B",
          number: "20",
          complement: null,
          neighborhood: "Centro",
          city: "São Paulo",
          postalCode: "01310000",
          country: "BR",
          state: "SP",
        },
      },
      items: [
        {
          skuSnapshot: "SKU-1",
          productNameSnapshot: "Luva",
          unitPriceInCents: 5000,
          quantity: 3,
          weightInGramsSnapshot: 200,
          heightInMillimetersSnapshot: 50,
          widthInMillimetersSnapshot: 100,
          lengthInMillimetersSnapshot: 200,
        },
        {
          skuSnapshot: "SKU-2",
          productNameSnapshot: "Óculos",
          unitPriceInCents: 12_000,
          quantity: 1,
          weightInGramsSnapshot: 300,
          heightInMillimetersSnapshot: 80,
          widthInMillimetersSnapshot: 100,
          lengthInMillimetersSnapshot: 200,
        },
      ],
    });

    expect(data.products).toEqual([
      expect.objectContaining({ id: "SKU-1", insuranceValueInCents: 5000, quantity: 3, weightInKg: 0.2 }),
      expect.objectContaining({ id: "SKU-2", insuranceValueInCents: 12_000, quantity: 1, weightInKg: 0.3 }),
    ]);
    expect(data.insuranceValueInCents).toBe(27_000);
    expect(data).not.toHaveProperty("volumes");
  });
});

describe("carrier volume rules", () => {
  it.each([
    ["Correios", false],
    ["J&T Express", false],
    ["Loggi", false],
    ["Jadlog", true],
    ["Azul Cargo Express", true],
  ])("%s accepts multiple volumes per label: %s", (carrier, expected) => {
    expect(carrierAcceptsMultipleVolumes(carrier)).toBe(expected);
  });

  it("copies only the measurements of the quoted packages", () => {
    expect(
      volumesFromQuotedPackages([
        { heightInCm: 1, widthInCm: 2, lengthInCm: 3, weightInKg: 0.4, insuranceValueInCents: 100 } as never,
      ]),
    ).toEqual([{ heightInCm: 1, widthInCm: 2, lengthInCm: 3, weightInKg: 0.4 }]);
  });
});
