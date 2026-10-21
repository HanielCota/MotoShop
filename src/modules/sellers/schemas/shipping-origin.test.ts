import { expect, it } from "vitest";

import { shippingOriginSchema } from "./shipping-origin";

const origin = {
  originName: "Garagem MX",
  originEmail: "envios@example.test",
  originPhone: "(11) 3333-4444",
  originDocument: "11222333000181",
  originPostalCode: "01001000",
  originStreet: "Rua A",
  originNumber: "10",
  originNeighborhood: "Centro",
  originCity: "São Paulo",
  originState: "SP",
};

it("stores the masked sender phone as digits and refuses an incomplete one", () => {
  expect(shippingOriginSchema.parse(origin).originPhone).toBe("1133334444");
  expect(shippingOriginSchema.safeParse({ ...origin, originPhone: "(11) 3333" }).success).toBe(false);
});
