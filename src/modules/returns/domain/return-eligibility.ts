/**
 * Regras de elegibilidade de devolução compartilhadas entre a página do pedido e o
 * application service, para que a UI nunca ofereça uma ação que o servidor recusaria.
 *
 * Devolução só faz sentido depois que o cliente recebeu o produto (AGENTS.md §24/§25):
 * antes da entrega o caminho correto é o cancelamento.
 */
export const activeReturnStatuses = [
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
  "WAITING_RETURN",
  "RETURNED",
  "REFUNDED",
] as const;

export type ActiveReturnStatus = (typeof activeReturnStatuses)[number];

export function isActiveReturnStatus(status: string): status is ActiveReturnStatus {
  return (activeReturnStatuses as readonly string[]).includes(status);
}

export function isSellerOrderEligibleForReturn(sellerOrderStatus: string): boolean {
  return sellerOrderStatus === "DELIVERED";
}

type ReturnItemSnapshot = { quantity: number; returnRequest: { status: string } };

/** Quantidade do item ainda livre para uma nova devolução (desconta devoluções ativas). */
export function getReturnableQuantity(item: { quantity: number; returnItems: ReturnItemSnapshot[] }): number {
  const requested = item.returnItems
    .filter((returnItem) => isActiveReturnStatus(returnItem.returnRequest.status))
    .reduce((total, returnItem) => total + returnItem.quantity, 0);
  return Math.max(0, item.quantity - requested);
}

export function canRequestReturn(input: {
  sellerOrderStatus: string;
  item: { quantity: number; returnItems: ReturnItemSnapshot[] };
}): boolean {
  return isSellerOrderEligibleForReturn(input.sellerOrderStatus) && getReturnableQuantity(input.item) > 0;
}
