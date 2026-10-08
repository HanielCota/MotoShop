import type { OrderStatus, SellerOrderStatus, ShipmentStatus } from "@/generated/prisma/enums";

export type ShipmentOperation = "PURCHASE" | "GENERATE" | "TRACK";

/**
 * Status do pedido da loja que admitem cada operação de envio integrada.
 * Pedidos cancelados, aguardando pagamento ou com cancelamento em análise (para compra e
 * geração) não podem receber etiqueta. O rastreio continua permitido após o envio, para que a
 * entrega possa ser registrada, e durante a análise de cancelamento, para que o admin decida
 * com o status real do envio.
 */
const shipmentOperationAllowedStatuses: Record<ShipmentOperation, readonly SellerOrderStatus[]> = {
  PURCHASE: ["PAID", "PROCESSING"],
  GENERATE: ["PAID", "PROCESSING", "SHIPPED"],
  TRACK: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLATION_REQUESTED"],
};

export function canRunShipmentOperation(status: SellerOrderStatus, operation: ShipmentOperation): boolean {
  return shipmentOperationAllowedStatuses[operation].includes(status);
}

export function getSellerOrderStatusFromShipment(
  currentStatus: SellerOrderStatus,
  shipmentStatus: ShipmentStatus,
): SellerOrderStatus {
  if (["CANCELLED", "CANCELLATION_REQUESTED", "DELIVERED", "PENDING_PAYMENT"].includes(currentStatus))
    return currentStatus;
  if (shipmentStatus === "DELIVERED") return "DELIVERED";
  if (shipmentStatus === "SHIPPED" || shipmentStatus === "IN_TRANSIT") return "SHIPPED";
  if (shipmentStatus === "READY_TO_SHIP" && currentStatus === "PAID") return "PROCESSING";
  return currentStatus;
}

const shipmentStatusProgress: Record<ShipmentStatus, number> = {
  PENDING: 0,
  READY_TO_SHIP: 1,
  SHIPPED: 2,
  EXCEPTION: 2.5,
  IN_TRANSIT: 3,
  DELIVERED: 4,
  CANCELLED: 5,
};

export function resolveShipmentStatus(current: ShipmentStatus, reported: ShipmentStatus | null): ShipmentStatus {
  if (reported === null) return current;
  if (current === "CANCELLED" || current === "DELIVERED") return current;
  if (reported === "CANCELLED" || reported === "DELIVERED") return reported;
  return shipmentStatusProgress[reported] >= shipmentStatusProgress[current] ? reported : current;
}

export function mapProviderShipmentStatus(value: string): ShipmentStatus | null {
  const status = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  if (status.includes("delivered") || status.includes("entregue")) return "DELIVERED";
  if (status.includes("transit") || status.includes("transito")) return "IN_TRANSIT";
  if (status.includes("posted") || status.includes("postado")) return "SHIPPED";
  if (status.includes("cancel")) return "CANCELLED";
  if (status.includes("exception") || status.includes("problema")) return "EXCEPTION";
  if (status.includes("ready_to_ship") || status.includes("pronto para envio")) return "READY_TO_SHIP";
  if (status.includes("pending") || status.includes("pendente")) return "PENDING";
  return null;
}

/**
 * Deriva o status global do pedido a partir dos pedidos por loja.
 *
 * O progresso das lojas ativas (não canceladas) tem precedência: um pedido com uma loja
 * cancelada e as demais entregues está "Entregue" para o cliente, não "Parcialmente cancelado".
 * `PARTIALLY_CANCELLED` só aparece quando as lojas restantes ainda não avançaram no envio.
 */
export function getOrderStatusFromSellerOrders(statuses: SellerOrderStatus[]): OrderStatus {
  if (statuses.length === 0) return "PENDING_PAYMENT";

  const activeStatuses = statuses.filter((status) => status !== "CANCELLED");
  if (activeStatuses.length === 0) return "CANCELLED";

  const isShippedOrDelivered = (status: SellerOrderStatus) => status === "SHIPPED" || status === "DELIVERED";
  if (activeStatuses.every((status) => status === "DELIVERED")) return "DELIVERED";
  if (activeStatuses.every(isShippedOrDelivered)) return "SHIPPED";
  if (activeStatuses.some(isShippedOrDelivered)) return "PARTIALLY_SHIPPED";

  if (activeStatuses.length < statuses.length) return "PARTIALLY_CANCELLED";

  if (activeStatuses.some((status) => status === "PROCESSING" || status === "CANCELLATION_REQUESTED")) {
    return "PROCESSING";
  }
  if (activeStatuses.every((status) => status === "PAID")) return "PAID";
  return "PENDING_PAYMENT";
}
