/** Seller order statuses that count as a sale: paid and not cancelled. The Admin and the Central do Lojista share it. */
export const confirmedSellerOrderStatuses = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;
