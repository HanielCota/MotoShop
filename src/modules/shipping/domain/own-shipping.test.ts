import { describe, expect, it } from "vitest";
import { ownShippingMethodSchema, quoteOwnShipping, canAdvanceOwnShipment } from "./own-shipping";
const method = {
  id: "method",
  name: "Entrega local",
  postalCodeStart: "01000000",
  postalCodeEnd: "01999999",
  priceInCents: 1500,
  estimatedDeliveryDays: 3,
  active: true,
};
describe("own shipping", () => {
  it("quotes inclusive boundaries, normalized CEPs and fixed integer price", () => {
    expect(quoteOwnShipping([method], "01000-000")[0]).toMatchObject({ provider: "OWN", priceInCents: 1500 });
    expect(quoteOwnShipping([method], "01999999")).toHaveLength(1);
    expect(quoteOwnShipping([method], "02000000")).toEqual([]);
  });
  it("does not offer disabled methods", () =>
    expect(quoteOwnShipping([{ ...method, active: false }], "01000000")).toEqual([]));
  it("rejects invalid ranges, negative money and fractional days", () => {
    for (const change of [{ postalCodeStart: "02000000" }, { priceInCents: -1 }, { estimatedDeliveryDays: 1.5 }])
      expect(ownShippingMethodSchema.safeParse({ ...method, ...change }).success).toBe(false);
  });
  it("accepts free shipping without external labels", () =>
    expect(ownShippingMethodSchema.parse({ ...method, priceInCents: 0 }).priceInCents).toBe(0));
  it("allows only paid dispatch and subsequent delivery", () => {
    expect(canAdvanceOwnShipment("PAID", "PENDING", "SHIPPED")).toBe(true);
    expect(canAdvanceOwnShipment("SHIPPED", "SHIPPED", "DELIVERED")).toBe(true);
    for (const state of ["PENDING_PAYMENT", "CANCELLED", "CANCELLATION_REQUESTED", "DELIVERED"])
      expect(canAdvanceOwnShipment(state, "PENDING", "SHIPPED")).toBe(false);
    expect(canAdvanceOwnShipment("PAID", "PENDING", "DELIVERED")).toBe(false);
  });
});
