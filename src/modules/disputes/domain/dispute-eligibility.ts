/** Regras para abrir disputa, compartilhadas entre a página do pedido e o application service. */
const sellerOrderStatusesWithoutDispute = ["PENDING_PAYMENT", "CANCELLED", "CANCELLATION_REQUESTED"] as const;
export const activeDisputeStatuses = ["OPEN", "UNDER_REVIEW"] as const;

export function isSellerOrderEligibleForDispute(status: string): boolean {
  return !(sellerOrderStatusesWithoutDispute as readonly string[]).includes(status);
}

export function canOpenDispute(input: { sellerOrderStatus: string; disputeStatuses: string[] }): boolean {
  return (
    isSellerOrderEligibleForDispute(input.sellerOrderStatus) &&
    !input.disputeStatuses.some((status) => (activeDisputeStatuses as readonly string[]).includes(status))
  );
}
