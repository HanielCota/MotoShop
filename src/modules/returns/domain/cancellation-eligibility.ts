/**
 * Regras de elegibilidade de cancelamento compartilhadas entre a página do pedido e o
 * application service (AGENTS.md §25): antes da postagem, sem cancelamento ou devolução em curso.
 */
export const cancellableSellerOrderStatuses = ["PAID", "PROCESSING"] as const;
export const blockingCancellationStatuses = ["REQUESTED", "APPROVED", "REFUNDED"] as const;
export const postedShipmentStatuses = ["SHIPPED", "IN_TRANSIT", "DELIVERED"] as const;

export function isSellerOrderCancellable(status: string): boolean {
  return (cancellableSellerOrderStatuses as readonly string[]).includes(status);
}

export function isShipmentPosted(status: string | null | undefined): boolean {
  return Boolean(status && (postedShipmentStatuses as readonly string[]).includes(status));
}

export function canRequestCancellation(input: {
  sellerOrderStatus: string;
  shipmentStatus?: string | null;
  cancellationStatuses: string[];
  returnStatuses: string[];
}): boolean {
  return (
    isSellerOrderCancellable(input.sellerOrderStatus) &&
    !isShipmentPosted(input.shipmentStatus) &&
    !input.cancellationStatuses.some((status) =>
      (blockingCancellationStatuses as readonly string[]).includes(status),
    ) &&
    !input.returnStatuses.some((status) => status !== "REJECTED")
  );
}
