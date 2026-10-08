import { createLoader, createParser, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

import { NotificationDeliveryStatus, WebhookEventStatus } from "@/generated/prisma/enums";
import { sellerOrderSortValues, shipmentStatusValues } from "@/modules/shipping/search-params";

/**
 * Limite de página aceito na URL. `?page=99999999999999999999` vira 1e20 e o `skip` calculado
 * estoura o inteiro de 64 bits aceito pelo Prisma, derrubando a seção inteira.
 */
export const MAX_ADMIN_PAGE = 10_000;

export function clampAdminPage(page: number | null | undefined) {
  if (typeof page !== "number" || !Number.isFinite(page)) return 1;
  return Math.min(Math.max(Math.trunc(page), 1), MAX_ADMIN_PAGE);
}

/** Página da URL limitada a `1..MAX_ADMIN_PAGE`. */
const parseAsAdminPage = createParser({
  parse: (value) => {
    const page = parseAsInteger.parse(value);
    return page === null ? null : clampAdminPage(page);
  },
  serialize: (value) => String(value),
}).withDefault(1);

/** Texto livre da URL sem caracteres NUL: o PostgreSQL rejeita U+0000 e a consulta falharia. */
const parseAsAdminText = createParser({
  parse: (value) => {
    const text = parseAsString.parse(value)?.replaceAll(String.fromCharCode(0), "");
    return text ? text : null;
  },
  serialize: (value) => value,
});

export const adminWebhookStatusValues = ["ALL", ...Object.values(WebhookEventStatus)] as const;
export const adminNotificationStatusValues = ["ALL", ...Object.values(NotificationDeliveryStatus)] as const;

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
  sellerQ: parseAsAdminText,
  sellerSort: parseAsStringLiteral(adminSellerSortValues).withDefault("newest"),
  sellerPage: parseAsAdminPage,
};

export const adminProductReviewSearchParams = {
  productReviewStatus: parseAsStringLiteral(adminProductReviewStatusValues).withDefault("ALL"),
  productReviewQ: parseAsAdminText,
  productReviewCategoryId: parseAsAdminText,
  productReviewBrandId: parseAsAdminText,
  productReviewSellerId: parseAsAdminText,
  productReviewFrom: parseAsAdminText,
  productReviewTo: parseAsAdminText,
  productReviewSort: parseAsStringLiteral(["newest", "oldest"] as const).withDefault("oldest"),
  productReviewPage: parseAsAdminPage,
};

export const adminOrderSearchParams = {
  adminOrderStatus: parseAsStringLiteral(adminOrderStatusValues).withDefault("ALL"),
  adminOrderShipmentStatus: parseAsStringLiteral(shipmentStatusValues).withDefault("ALL"),
  adminOrderQ: parseAsAdminText,
  adminOrderSellerId: parseAsAdminText,
  adminOrderFrom: parseAsAdminText,
  adminOrderTo: parseAsAdminText,
  adminOrderSort: parseAsStringLiteral(sellerOrderSortValues).withDefault("newest"),
  adminOrderPage: parseAsAdminPage,
};

export const adminAuditSearchParams = {
  auditAction: parseAsAdminText,
  auditEntityType: parseAsAdminText,
  auditQ: parseAsAdminText,
  auditActorQ: parseAsAdminText,
  auditFrom: parseAsAdminText,
  auditTo: parseAsAdminText,
  auditSort: sortNewestFirst,
  auditPage: parseAsAdminPage,
};

export const adminWebhookSearchParams = {
  webhookStatus: parseAsStringLiteral(adminWebhookStatusValues),
  webhookQ: parseAsAdminText,
  webhookProvider: parseAsAdminText,
  webhookFrom: parseAsAdminText,
  webhookTo: parseAsAdminText,
  webhookSort: sortNewestFirst,
  webhookPage: parseAsAdminPage,
};

export const adminNotificationSearchParams = {
  notificationStatus: parseAsStringLiteral(adminNotificationStatusValues),
  notificationQ: parseAsAdminText,
  notificationKind: parseAsAdminText,
  notificationFrom: parseAsAdminText,
  notificationTo: parseAsAdminText,
  notificationSort: sortNewestFirst,
  notificationPage: parseAsAdminPage,
};

export const adminReturnSearchParams = {
  returnStatus: parseAsStringLiteral(adminReturnStatusValues).withDefault("ALL"),
  returnQ: parseAsAdminText,
  returnSellerId: parseAsAdminText,
  returnFrom: parseAsAdminText,
  returnTo: parseAsAdminText,
  returnSort: parseAsStringLiteral(adminPostSaleSortValues).withDefault("oldest"),
  returnPage: parseAsAdminPage,
};

export const adminCancellationSearchParams = {
  cancellationStatus: parseAsStringLiteral(adminCancellationStatusValues).withDefault("ALL"),
  cancellationQ: parseAsAdminText,
  cancellationSellerId: parseAsAdminText,
  cancellationFrom: parseAsAdminText,
  cancellationTo: parseAsAdminText,
  cancellationSort: parseAsStringLiteral(adminPostSaleSortValues).withDefault("oldest"),
  cancellationPage: parseAsAdminPage,
};

export const adminDisputeSearchParams = {
  disputeStatus: parseAsStringLiteral(adminDisputeStatusValues).withDefault("ALL"),
  disputeQ: parseAsAdminText,
  disputeSellerId: parseAsAdminText,
  disputeFrom: parseAsAdminText,
  disputeTo: parseAsAdminText,
  disputeSort: parseAsStringLiteral(adminPostSaleSortValues).withDefault("oldest"),
  disputePage: parseAsAdminPage,
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
