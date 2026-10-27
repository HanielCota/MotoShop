import { expect, it } from "vitest";

import { getStatusLabel } from "./status-labels";

it("calls a store's own delivery ready to send, since it has no label to buy", () => {
  expect(getStatusLabel("ownShipment", "READY_TO_SHIP")).toBe("Pronto para envio");
  expect(getStatusLabel("shipment", "READY_TO_SHIP")).toBe("Etiqueta pronta");
  expect(getStatusLabel("ownShipment", "SHIPPED")).toBe(getStatusLabel("shipment", "SHIPPED"));
});
