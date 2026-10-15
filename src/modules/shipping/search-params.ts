import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

import { sellerOrderQueueValues } from "./domain/seller-order-queue";

export const sellerOrderStatusValues = [
  "ALL",
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLATION_REQUESTED",
  "CANCELLED",
] as const;
export const shipmentStatusValues = [
  "ALL",
  "PENDING",
  "READY_TO_SHIP",
  "SHIPPED",
  "IN_TRANSIT",
  "DELIVERED",
  "EXCEPTION",
  "CANCELLED",
] as const;
export const sellerOrderSortValues = ["newest", "oldest"] as const;

export const sellerOrdersSearchParams = {
  queue: parseAsStringLiteral(sellerOrderQueueValues).withDefault("TO_PREPARE"),
  q: parseAsString,
  from: parseAsString,
  to: parseAsString,
  sort: parseAsStringLiteral(sellerOrderSortValues).withDefault("newest"),
  status: parseAsStringLiteral(sellerOrderStatusValues).withDefault("ALL"),
  shipmentStatus: parseAsStringLiteral(shipmentStatusValues).withDefault("ALL"),
  page: parseAsInteger.withDefault(1),
};

export const loadSellerOrdersSearchParams = createLoader(sellerOrdersSearchParams);
