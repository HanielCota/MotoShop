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

const sortNewestFirst = parseAsStringLiteral(["newest", "oldest"] as const).withDefault("newest");

export const adminSellerSearchParams = {
  sellerStatus: parseAsStringLiteral(adminSellerStatusValues).withDefault("ALL"),
  sellerQ: parseAsString,
  sellerSort: parseAsStringLiteral(adminSellerSortValues).withDefault("newest"),
  sellerPage: parseAsInteger.withDefault(1),
};

export const adminProductReviewSearchParams = {
  productReviewStatus: parseAsStringLiteral(adminProductReviewStatusValues).withDefault("ALL"),
  productReviewQ: parseAsString,
  productReviewCategoryId: parseAsString,
  productReviewBrandId: parseAsString,
  productReviewSellerId: parseAsString,
  productReviewFrom: parseAsString,
  productReviewTo: parseAsString,
  productReviewSort: parseAsStringLiteral(["newest", "oldest"] as const).withDefault("oldest"),
  productReviewPage: parseAsInteger.withDefault(1),
};

export const adminOrderSearchParams = {
  adminOrderStatus: parseAsStringLiteral(adminOrderStatusValues).withDefault("ALL"),
  adminOrderShipmentStatus: parseAsStringLiteral(shipmentStatusValues).withDefault("ALL"),
  adminOrderQ: parseAsString,
  adminOrderSellerId: parseAsString,
  adminOrderFrom: parseAsString,
  adminOrderTo: parseAsString,
  adminOrderSort: parseAsStringLiteral(sellerOrderSortValues).withDefault("newest"),
  adminOrderPage: parseAsInteger.withDefault(1),
};

export const adminAuditSearchParams = {
  auditAction: parseAsString,
  auditEntityType: parseAsString,
  auditQ: parseAsString,
  auditActorQ: parseAsString,
  auditFrom: parseAsString,
  auditTo: parseAsString,
  auditSort: sortNewestFirst,
  auditPage: parseAsInteger.withDefault(1),
};

export const adminWebhookSearchParams = {
  webhookStatus: parseAsString,
  webhookQ: parseAsString,
  webhookProvider: parseAsString,
  webhookFrom: parseAsString,
  webhookTo: parseAsString,
  webhookSort: sortNewestFirst,
  webhookPage: parseAsInteger.withDefault(1),
};

export const adminNotificationSearchParams = {
  notificationStatus: parseAsString,
  notificationQ: parseAsString,
  notificationKind: parseAsString,
  notificationFrom: parseAsString,
  notificationTo: parseAsString,
  notificationSort: sortNewestFirst,
  notificationPage: parseAsInteger.withDefault(1),
};

export const adminReturnSearchParams = {
  returnStatus: parseAsStringLiteral(adminReturnStatusValues).withDefault("ALL"),
  returnQ: parseAsString,
  returnSellerId: parseAsString,
  returnFrom: parseAsString,
  returnTo: parseAsString,
  returnSort: parseAsStringLiteral(adminPostSaleSortValues).withDefault("oldest"),
  returnPage: parseAsInteger.withDefault(1),
};

export const adminCancellationSearchParams = {
  cancellationStatus: parseAsStringLiteral(adminCancellationStatusValues).withDefault("ALL"),
  cancellationQ: parseAsString,
  cancellationSellerId: parseAsString,
  cancellationFrom: parseAsString,
  cancellationTo: parseAsString,
  cancellationSort: parseAsStringLiteral(adminPostSaleSortValues).withDefault("oldest"),
  cancellationPage: parseAsInteger.withDefault(1),
};

export const adminDisputeSearchParams = {
  disputeStatus: parseAsStringLiteral(adminDisputeStatusValues).withDefault("ALL"),
  disputeQ: parseAsString,
  disputeSellerId: parseAsString,
  disputeFrom: parseAsString,
  disputeTo: parseAsString,
  disputeSort: parseAsStringLiteral(adminPostSaleSortValues).withDefault("oldest"),
  disputePage: parseAsInteger.withDefault(1),
};

/** Cada seção do Admin carrega somente os próprios parâmetros. */
export const loadAdminSellerSearchParams = createLoader(adminSellerSearchParams);
export const loadAdminProductReviewSearchParams = createLoader(adminProductReviewSearchParams);
export const loadAdminOrderSearchParams = createLoader(adminOrderSearchParams);
export const loadAdminAuditSearchParams = createLoader(adminAuditSearchParams);
export const loadAdminWebhookSearchParams = createLoader(adminWebhookSearchParams);
export const loadAdminNotificationSearchParams = createLoader(adminNotificationSearchParams);
export const loadAdminReturnSearchParams = createLoader(adminReturnSearchParams);
export const loadAdminCancellationSearchParams = createLoader(adminCancellationSearchParams);
export const loadAdminDisputeSearchParams = createLoader(adminDisputeSearchParams);

export const adminSearchParams = {
  ...adminSellerSearchParams,
  ...adminProductReviewSearchParams,
  ...adminOrderSearchParams,
  ...adminAuditSearchParams,
  ...adminWebhookSearchParams,
  ...adminNotificationSearchParams,
  ...adminReturnSearchParams,
  ...adminCancellationSearchParams,
  ...adminDisputeSearchParams,
};

export const loadAdminSearchParams = createLoader(adminSearchParams);
