import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

import { sellerOrderSortValues, shipmentStatusValues } from "@/modules/shipping/search-params";

export const adminSellerStatusValues = [
  "ALL",
  "PENDING",
  "APPROVED",
  "ACTIVE",
  "SUSPENDED",
  "BLOCKED",
  "REJECTED",
] as const;
export type AdminSellerStatus = (typeof adminSellerStatusValues)[number];
export const adminSellerSortValues = ["newest", "oldest"] as const;

export const adminProductReviewStatusValues = ["ALL", "SUBMITTED", "REJECTED"] as const;
export type AdminProductReviewStatus = (typeof adminProductReviewStatusValues)[number];

export const adminOrderStatusValues = [
  "ALL",
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLATION_REQUESTED",
  "CANCELLED",
] as const;
export type AdminOrderStatus = (typeof adminOrderStatusValues)[number];

export const adminReturnStatusValues = ["ALL", "REQUESTED", "UNDER_REVIEW", "APPROVED", "RETURNED"] as const;
export const adminCancellationStatusValues = ["ALL", "REQUESTED", "APPROVED"] as const;
export const adminDisputeStatusValues = ["ALL", "OPEN", "UNDER_REVIEW"] as const;
export const adminPostSaleSortValues = ["oldest", "newest"] as const;

export const adminSearchParams = {
  sellerStatus: parseAsStringLiteral(adminSellerStatusValues).withDefault("ALL"),
  sellerQ: parseAsString,
  sellerSort: parseAsStringLiteral(adminSellerSortValues).withDefault("newest"),
  sellerPage: parseAsInteger.withDefault(1),
  productReviewStatus: parseAsStringLiteral(adminProductReviewStatusValues).withDefault("ALL"),
  productReviewQ: parseAsString,
  productReviewCategoryId: parseAsString,
  productReviewBrandId: parseAsString,
  productReviewSellerId: parseAsString,
  productReviewPage: parseAsInteger.withDefault(1),
  productReviewSort: parseAsStringLiteral(["newest", "oldest"] as const).withDefault("oldest"),
  adminOrderStatus: parseAsStringLiteral(adminOrderStatusValues).withDefault("ALL"),
  adminOrderShipmentStatus: parseAsStringLiteral(shipmentStatusValues).withDefault("ALL"),
  adminOrderQ: parseAsString,
  adminOrderSellerId: parseAsString,
  adminOrderFrom: parseAsString,
  adminOrderTo: parseAsString,
  adminOrderSort: parseAsStringLiteral(sellerOrderSortValues).withDefault("newest"),
  adminOrderPage: parseAsInteger.withDefault(1),
  productReviewFrom: parseAsString,
  productReviewTo: parseAsString,
  auditAction: parseAsString,
  auditEntityType: parseAsString,
  auditQ: parseAsString,
  auditActorQ: parseAsString,
  auditFrom: parseAsString,
  auditTo: parseAsString,
  auditSort: parseAsStringLiteral(["newest", "oldest"] as const).withDefault("newest"),
  auditPage: parseAsInteger.withDefault(1),
  webhookStatus: parseAsString,
  webhookQ: parseAsString,
  webhookProvider: parseAsString,
  webhookFrom: parseAsString,
  webhookTo: parseAsString,
  webhookSort: parseAsStringLiteral(["newest", "oldest"] as const).withDefault("newest"),
  webhookPage: parseAsInteger.withDefault(1),
  notificationStatus: parseAsString,
  notificationQ: parseAsString,
  notificationKind: parseAsString,
  notificationFrom: parseAsString,
  notificationTo: parseAsString,
  notificationSort: parseAsStringLiteral(["newest", "oldest"] as const).withDefault("newest"),
  notificationPage: parseAsInteger.withDefault(1),
  returnStatus: parseAsStringLiteral(adminReturnStatusValues).withDefault("ALL"),
  returnQ: parseAsString,
  returnSellerId: parseAsString,
  returnFrom: parseAsString,
  returnTo: parseAsString,
  returnSort: parseAsStringLiteral(adminPostSaleSortValues).withDefault("oldest"),
  returnPage: parseAsInteger.withDefault(1),
  cancellationStatus: parseAsStringLiteral(adminCancellationStatusValues).withDefault("ALL"),
  cancellationQ: parseAsString,
  cancellationSellerId: parseAsString,
  cancellationFrom: parseAsString,
  cancellationTo: parseAsString,
  cancellationSort: parseAsStringLiteral(adminPostSaleSortValues).withDefault("oldest"),
  cancellationPage: parseAsInteger.withDefault(1),
  disputeStatus: parseAsStringLiteral(adminDisputeStatusValues).withDefault("ALL"),
  disputeQ: parseAsString,
  disputeSellerId: parseAsString,
  disputeFrom: parseAsString,
  disputeTo: parseAsString,
  disputeSort: parseAsStringLiteral(adminPostSaleSortValues).withDefault("oldest"),
  disputePage: parseAsInteger.withDefault(1),
};

export const loadAdminSearchParams = createLoader(adminSearchParams);
