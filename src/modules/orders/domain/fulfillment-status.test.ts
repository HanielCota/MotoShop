import { describe, expect, it } from "vitest";

import { getOrderStatusFromSellerOrders, getSellerOrderStatusFromShipment } from "./fulfillment-status";

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
