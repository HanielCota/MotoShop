import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

export const customerOrderStatusValues = [
  "ALL",
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "PARTIALLY_SHIPPED",
  "SHIPPED",
  "DELIVERED",
  "PARTIALLY_CANCELLED",
  "CANCELLED",
] as const;
export type CustomerOrderStatus = (typeof customerOrderStatusValues)[number];
export const customerPaymentStatusValues = [
  "ALL",
  "PENDING",
  "PROCESSING",
  "AUTHORIZED",
  "APPROVED",
  "FAILED",
  "CANCELLED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const;
export const customerShipmentStatusValues = [
  "ALL",
  "PENDING",
  "READY_TO_SHIP",
  "SHIPPED",
  "IN_TRANSIT",
  "DELIVERED",
  "EXCEPTION",
  "CANCELLED",
] as const;
export const customerOrderSortValues = ["newest", "oldest", "total_high", "total_low"] as const;

export const customerOrderSearchParams = {
  orderStatus: parseAsStringLiteral(customerOrderStatusValues).withDefault("ALL"),
  orderQ: parseAsString,
  storeQ: parseAsString,
  shipmentStatus: parseAsStringLiteral(customerShipmentStatusValues).withDefault("ALL"),
  paymentStatus: parseAsStringLiteral(customerPaymentStatusValues).withDefault("ALL"),
  orderFrom: parseAsString,
  orderTo: parseAsString,
  orderMinTotal: parseAsString,
  orderMaxTotal: parseAsString,
  orderSort: parseAsStringLiteral(customerOrderSortValues).withDefault("newest"),
  orderPage: parseAsInteger.withDefault(1),
};

export const loadCustomerOrderSearchParams = createLoader(customerOrderSearchParams);
