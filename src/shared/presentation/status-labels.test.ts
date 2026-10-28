import { expect, it } from "vitest";

import { getStatusLabel, getStatusOptions } from "./status-labels";

it("calls a store's own delivery ready to send, since it has no label to buy", () => {
  expect(getStatusLabel("ownShipment", "READY_TO_SHIP")).toBe("Pronto para envio");
  expect(getStatusLabel("shipment", "READY_TO_SHIP")).toBe("Etiqueta pronta");
  expect(getStatusLabel("ownShipment", "SHIPPED")).toBe(getStatusLabel("shipment", "SHIPPED"));
});

it("offers the same ready-to-send wording in the seller shipment filter", () => {
  expect(getStatusOptions("ownShipment")).toContainEqual({ value: "READY_TO_SHIP", label: "Pronto para envio" });
});
