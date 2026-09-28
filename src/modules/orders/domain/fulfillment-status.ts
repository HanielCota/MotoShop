import type { OrderStatus, SellerOrderStatus, ShipmentStatus } from "@/generated/prisma/enums";

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

export function getOrderStatusFromSellerOrders(statuses: SellerOrderStatus[]): OrderStatus {
  if (statuses.length === 0) return "PENDING_PAYMENT";

  const activeStatuses = statuses.filter((status) => status !== "CANCELLED");
  if (activeStatuses.length === 0) return "CANCELLED";
  if (statuses.some((status) => status === "CANCELLED")) return "PARTIALLY_CANCELLED";
  if (activeStatuses.every((status) => status === "DELIVERED")) return "DELIVERED";
  if (activeStatuses.every((status) => status === "SHIPPED" || status === "DELIVERED")) return "SHIPPED";
  if (activeStatuses.some((status) => status === "SHIPPED" || status === "DELIVERED")) {
    return "PARTIALLY_SHIPPED";
  }
  if (activeStatuses.some((status) => status === "PROCESSING" || status === "CANCELLATION_REQUESTED")) {
    return "PROCESSING";
  }
  if (activeStatuses.every((status) => status === "PAID")) return "PAID";
  return "PENDING_PAYMENT";
}
