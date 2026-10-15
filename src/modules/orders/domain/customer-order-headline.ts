/**
 * One status per order in the customer's words, instead of the order, payment, store and shipment
 * badges side by side. Pending payment comes first: it is the customer's next action.
 */
const headlineByStatus: Record<string, string> = {
  PENDING_PAYMENT: "Pague para confirmar",
  PAID: "Em preparação",
  PROCESSING: "Em preparação",
  PARTIALLY_SHIPPED: "A caminho",
  SHIPPED: "A caminho",
  DELIVERED: "Entregue",
  PARTIALLY_CANCELLED: "Parte cancelada",
  CANCELLED: "Cancelado",
};

export function customerOrderHeadline(status: string) {
  return headlineByStatus[status] ?? "Em andamento";
}
