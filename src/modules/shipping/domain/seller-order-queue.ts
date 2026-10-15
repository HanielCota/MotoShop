import type { SellerOrderStatus } from "@/generated/prisma/enums";

export const sellerOrderQueueValues = ["TO_PREPARE", "AWAITING_PAYMENT", "SHIPPED", "ALL"] as const;
export type SellerOrderQueue = (typeof sellerOrderQueueValues)[number];

const queueStatuses: Record<SellerOrderQueue, readonly SellerOrderStatus[] | null> = {
  TO_PREPARE: ["PAID", "PROCESSING"],
  AWAITING_PAYMENT: ["PENDING_PAYMENT"],
  SHIPPED: ["SHIPPED", "DELIVERED"],
  ALL: null,
};

export const sellerOrderQueueLabels: Record<SellerOrderQueue, string> = {
  TO_PREPARE: "A preparar",
  AWAITING_PAYMENT: "Aguardando pagamento",
  SHIPPED: "Enviados",
  ALL: "Todos",
};

/** Status da fila; `null` significa todos os pedidos da loja. */
export function getSellerOrderQueueStatuses(queue: SellerOrderQueue): readonly SellerOrderStatus[] | null {
  return queueStatuses[queue];
}

/** Um status escolhido no filtro vale mais que a aba: a busca passa a ser em todos os pedidos. */
export function resolveSellerOrderQueue(queue: SellerOrderQueue, status: string): SellerOrderQueue {
  return status === "ALL" ? queue : "ALL";
}

export function countSellerOrdersInQueue(
  queue: SellerOrderQueue,
  countsByStatus: Partial<Record<SellerOrderStatus, number>>,
): number {
  const statuses = queueStatuses[queue] ?? (Object.keys(countsByStatus) as SellerOrderStatus[]);
  return statuses.reduce((total, status) => total + (countsByStatus[status] ?? 0), 0);
}

/** Só pedido pago pode ser preparado: antes disso, despachar é risco de envio sem pagamento. */
export function canPrepareSellerOrder(status: SellerOrderStatus): boolean {
  return status === "PAID" || status === "PROCESSING";
}

/** Endereço e telefone do cliente só a partir do pagamento confirmado (AGENTS §34). */
export function canShowSellerOrderDeliveryData(status: SellerOrderStatus): boolean {
  return canPrepareSellerOrder(status) || status === "SHIPPED" || status === "DELIVERED";
}
