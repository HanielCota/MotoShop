import { describe, expect, it } from "vitest";

import {
  formatUnitsSold,
  isSaleReversingReturnStatus,
  isSoldSellerOrderStatus,
  netUnitsSold,
  SOLD_SELLER_ORDER_STATUSES,
} from "./units-sold";

describe("units sold rule", () => {
  it.each(["PAID", "PROCESSING", "SHIPPED", "DELIVERED"])("counts %s seller orders as sold", (status) => {
    expect(isSoldSellerOrderStatus(status)).toBe(true);
  });

  it.each(["PENDING_PAYMENT", "CANCELLATION_REQUESTED", "CANCELLED"])("does not count %s seller orders", (status) => {
    expect(isSoldSellerOrderStatus(status)).toBe(false);
  });

  it("matches the seller financial summary statuses", () => {
    expect([...SOLD_SELLER_ORDER_STATUSES]).toEqual(["PAID", "PROCESSING", "SHIPPED", "DELIVERED"]);
  });

  it("only refunded returns reverse a sale", () => {
    expect(isSaleReversingReturnStatus("REFUNDED")).toBe(true);
    for (const status of ["REQUESTED", "UNDER_REVIEW", "APPROVED", "WAITING_RETURN", "RETURNED", "REJECTED"]) {
      expect(isSaleReversingReturnStatus(status)).toBe(false);
    }
  });

  it("subtracts refunded units and never goes negative", () => {
    expect(netUnitsSold(10, 3)).toBe(7);
    expect(netUnitsSold(null, null)).toBe(0);
    expect(netUnitsSold(2, 5)).toBe(0);
  });

  it("formats only positive totals", () => {
    expect(formatUnitsSold(0)).toBeNull();
    expect(formatUnitsSold(1)).toBe("1 vendido");
    expect(formatUnitsSold(1234)).toBe("1.234 vendidos");
  });
});
