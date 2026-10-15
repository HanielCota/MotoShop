import { describe, expect, it } from "vitest";

import {
  canPrepareSellerOrder,
  canShowSellerOrderDeliveryData,
  countSellerOrdersInQueue,
  getSellerOrderQueueStatuses,
  resolveSellerOrderQueue,
} from "./seller-order-queue";

describe("seller order queue", () => {
  it("maps each tab to its statuses", () => {
    expect(getSellerOrderQueueStatuses("TO_PREPARE")).toEqual(["PAID", "PROCESSING"]);
    expect(getSellerOrderQueueStatuses("AWAITING_PAYMENT")).toEqual(["PENDING_PAYMENT"]);
    expect(getSellerOrderQueueStatuses("SHIPPED")).toEqual(["SHIPPED", "DELIVERED"]);
    expect(getSellerOrderQueueStatuses("ALL")).toBeNull();
  });

  it("lets an explicit status filter search every order", () => {
    expect(resolveSellerOrderQueue("TO_PREPARE", "ALL")).toBe("TO_PREPARE");
    expect(resolveSellerOrderQueue("TO_PREPARE", "CANCELLED")).toBe("ALL");
  });

  it("sums the counts of the statuses in the tab", () => {
    const counts = { PAID: 2, PROCESSING: 1, PENDING_PAYMENT: 3, CANCELLED: 4 };
    expect(countSellerOrdersInQueue("TO_PREPARE", counts)).toBe(3);
    expect(countSellerOrdersInQueue("SHIPPED", counts)).toBe(0);
    expect(countSellerOrdersInQueue("ALL", counts)).toBe(10);
  });

  it("only prepares paid orders", () => {
    expect(canPrepareSellerOrder("PAID")).toBe(true);
    expect(canPrepareSellerOrder("PROCESSING")).toBe(true);
    expect(canPrepareSellerOrder("PENDING_PAYMENT")).toBe(false);
    expect(canPrepareSellerOrder("CANCELLATION_REQUESTED")).toBe(false);
  });

  it("hides delivery data before payment and while a cancellation is pending", () => {
    expect(canShowSellerOrderDeliveryData("PENDING_PAYMENT")).toBe(false);
    expect(canShowSellerOrderDeliveryData("CANCELLATION_REQUESTED")).toBe(false);
    expect(canShowSellerOrderDeliveryData("CANCELLED")).toBe(false);
    expect(canShowSellerOrderDeliveryData("SHIPPED")).toBe(true);
  });
});
