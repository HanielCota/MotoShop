import { describe, expect, it } from "vitest";

import {
  getOrderStatusFromSellerOrders,
  getSellerOrderStatusFromShipment,
  mapProviderShipmentStatus,
  resolveShipmentStatus,
} from "./fulfillment-status";

describe("fulfillment status", () => {
  it("does not regress delivery or advance an unpaid order on tracking events", () => {
    expect(getSellerOrderStatusFromShipment("DELIVERED", "IN_TRANSIT")).toBe("DELIVERED");
    expect(getSellerOrderStatusFromShipment("PENDING_PAYMENT", "DELIVERED")).toBe("PENDING_PAYMENT");
  });
  it("moves a paid seller order to processing when the label is ready", () => {
    expect(getSellerOrderStatusFromShipment("PAID", "READY_TO_SHIP")).toBe("PROCESSING");
    expect(getSellerOrderStatusFromShipment("PROCESSING", "READY_TO_SHIP")).toBe("PROCESSING");
  });

  it("maps shipment progress without regressing cancellation", () => {
    expect(getSellerOrderStatusFromShipment("PROCESSING", "IN_TRANSIT")).toBe("SHIPPED");
    expect(getSellerOrderStatusFromShipment("SHIPPED", "DELIVERED")).toBe("DELIVERED");
    expect(getSellerOrderStatusFromShipment("CANCELLATION_REQUESTED", "SHIPPED")).toBe("CANCELLATION_REQUESTED");
  });

  it("derives the global order status from seller orders", () => {
    expect(getOrderStatusFromSellerOrders(["PAID", "PAID"])).toBe("PAID");
    expect(getOrderStatusFromSellerOrders(["SHIPPED", "PAID"])).toBe("PARTIALLY_SHIPPED");
    expect(getOrderStatusFromSellerOrders(["SHIPPED", "DELIVERED"])).toBe("SHIPPED");
    expect(getOrderStatusFromSellerOrders(["DELIVERED", "DELIVERED"])).toBe("DELIVERED");
    expect(getOrderStatusFromSellerOrders(["CANCELLED", "DELIVERED"])).toBe("PARTIALLY_CANCELLED");
  });
});

describe("provider shipment status reconciliation", () => {
  it.each([
    ["status conhecido", "IN_TRANSIT", "IN_TRANSIT"],
    ["status desconhecido", "novo_estado", null],
    ["status traduzido", "entregue ao destinatario", "DELIVERED"],
    ["status acentuado", "em trânsito", "IN_TRANSIT"],
  ] as const)("mapeia %s sem inventar um estado", (_label, value, expected) => {
    expect(mapProviderShipmentStatus(value)).toBe(expected);
  });

  it.each([
    ["SHIPPED", "READY_TO_SHIP", "SHIPPED"],
    ["DELIVERED", "IN_TRANSIT", "DELIVERED"],
    ["READY_TO_SHIP", "IN_TRANSIT", "IN_TRANSIT"],
    ["PENDING", null, "PENDING"],
    ["CANCELLED", "DELIVERED", "CANCELLED"],
  ] as const)("não regride de %s para %s", (current, reported, expected) => {
    expect(resolveShipmentStatus(current, reported)).toBe(expected);
  });
});
