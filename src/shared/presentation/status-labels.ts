/**
 * Fonte única de rótulos (pt-BR) e tons visuais para os status do domínio.
 * Páginas e componentes não devem declarar mapas próprios: use `getStatusPresentation`
 * ou o componente `StatusBadge`.
 */
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

export type StatusPresentation = { label: string; tone: StatusTone };

type StatusMap = Record<string, StatusPresentation>;

const order: StatusMap = {
  PENDING_PAYMENT: { label: "Aguardando pagamento", tone: "warning" },
  PAID: { label: "Pago", tone: "info" },
  PROCESSING: { label: "Em preparação", tone: "info" },
  PARTIALLY_SHIPPED: { label: "Parcialmente enviado", tone: "info" },
  SHIPPED: { label: "Enviado", tone: "brand" },
  DELIVERED: { label: "Entregue", tone: "success" },
  PARTIALLY_CANCELLED: { label: "Parcialmente cancelado", tone: "warning" },
  CANCELLATION_REQUESTED: { label: "Cancelamento em análise", tone: "warning" },
  CANCELLED: { label: "Cancelado", tone: "danger" },
};

const shipment: StatusMap = {
  PENDING: { label: "Aguardando envio", tone: "neutral" },
  READY_TO_SHIP: { label: "Etiqueta pronta", tone: "info" },
  SHIPPED: { label: "Postado", tone: "brand" },
  IN_TRANSIT: { label: "Em trânsito", tone: "brand" },
  DELIVERED: { label: "Entregue", tone: "success" },
  EXCEPTION: { label: "Problema no envio", tone: "danger" },
  CANCELLED: { label: "Envio cancelado", tone: "danger" },
};

const payment: StatusMap = {
  PENDING: { label: "Pendente", tone: "warning" },
  PROCESSING: { label: "Processando", tone: "info" },
  AUTHORIZED: { label: "Autorizado", tone: "info" },
  APPROVED: { label: "Aprovado", tone: "success" },
  FAILED: { label: "Recusado", tone: "danger" },
  CANCELLED: { label: "Cancelado", tone: "danger" },
  PARTIALLY_REFUNDED: { label: "Parcialmente reembolsado", tone: "warning" },
  REFUNDED: { label: "Reembolsado", tone: "neutral" },
};

const returnRequest: StatusMap = {
  REQUESTED: { label: "Solicitada", tone: "warning" },
  UNDER_REVIEW: { label: "Em análise", tone: "info" },
  APPROVED: { label: "Aprovada", tone: "info" },
  WAITING_RETURN: { label: "Aguardando postagem", tone: "info" },
  RETURNED: { label: "Recebida pela loja", tone: "brand" },
  REFUNDED: { label: "Reembolsada", tone: "success" },
  REJECTED: { label: "Recusada", tone: "danger" },
};

const cancellation: StatusMap = {
  REQUESTED: { label: "Solicitado", tone: "warning" },
  APPROVED: { label: "Aprovado", tone: "info" },
  REFUNDED: { label: "Reembolsado", tone: "success" },
  REJECTED: { label: "Recusado", tone: "danger" },
};

const dispute: StatusMap = {
  OPEN: { label: "Aberta", tone: "warning" },
  UNDER_REVIEW: { label: "Em análise", tone: "info" },
  RESOLVED: { label: "Resolvida", tone: "success" },
  REJECTED: { label: "Rejeitada", tone: "danger" },
};

const seller: StatusMap = {
  PENDING: { label: "Em análise", tone: "warning" },
  APPROVED: { label: "Aprovado", tone: "success" },
  ACTIVE: { label: "Ativo", tone: "success" },
  SUSPENDED: { label: "Suspenso", tone: "warning" },
  BLOCKED: { label: "Bloqueado", tone: "danger" },
  REJECTED: { label: "Recusado", tone: "danger" },
};

const product: StatusMap = {
  DRAFT: { label: "Rascunho", tone: "neutral" },
  SUBMITTED: { label: "Em análise", tone: "warning" },
  APPROVED: { label: "Publicado", tone: "success" },
  REJECTED: { label: "Recusado", tone: "danger" },
  ARCHIVED: { label: "Arquivado", tone: "neutral" },
};

const webhook: StatusMap = {
  RECEIVED: { label: "Recebido", tone: "neutral" },
  PROCESSING: { label: "Processando", tone: "info" },
  PROCESSED: { label: "Processado", tone: "success" },
  FAILED: { label: "Falhou", tone: "danger" },
};

const notification: StatusMap = {
  PROCESSING: { label: "Processando", tone: "info" },
  SENT: { label: "Enviado", tone: "success" },
  FAILED: { label: "Falhou", tone: "danger" },
};

const outbox: StatusMap = {
  PENDING: { label: "Pendente", tone: "warning" },
  PROCESSING: { label: "Processando", tone: "info" },
  DISPATCHED: { label: "Despachado", tone: "success" },
  FAILED: { label: "Falhou", tone: "danger" },
};

const subscription: StatusMap = {
  ACTIVE: { label: "Ativa", tone: "success" },
  PAST_DUE: { label: "Em atraso", tone: "warning" },
  CANCELLED: { label: "Cancelada", tone: "danger" },
  EXPIRED: { label: "Expirada", tone: "neutral" },
};

const statusMaps = {
  order,
  sellerOrder: order,
  shipment,
  payment,
  return: returnRequest,
  cancellation,
  dispute,
  seller,
  product,
  webhook,
  notification,
  outbox,
  subscription,
} as const satisfies Record<string, StatusMap>;

export type StatusDomain = keyof typeof statusMaps;

export function getStatusPresentation(domain: StatusDomain, status: string): StatusPresentation {
  return statusMaps[domain][status] ?? { label: humanizeStatus(status), tone: "neutral" };
}

export function getStatusLabel(domain: StatusDomain, status: string): string {
  return getStatusPresentation(domain, status).label;
}

/** Opções prontas para selects de filtro. */
export function getStatusOptions(domain: StatusDomain): { value: string; label: string }[] {
  return Object.entries(statusMaps[domain]).map(([value, { label }]) => ({ value, label }));
}

function humanizeStatus(status: string): string {
  const text = status.toLowerCase().replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const returnReasonLabels: Record<string, string> = {
  DAMAGED: "Produto danificado",
  WRONG_ITEM: "Item diferente do pedido",
  NOT_AS_DESCRIBED: "Diferente do anúncio",
  REGRET: "Desistência",
  OTHER: "Outro motivo",
};

export const disputeReasonLabels: Record<string, string> = {
  ITEM_PROBLEM: "Problema com o item",
  DELIVERY_PROBLEM: "Problema na entrega",
  SELLER_SUPPORT: "Preciso de ajuda do lojista",
  OTHER: "Outro motivo",
};

export const inventoryMovementLabels: Record<string, string> = {
  SALE: "Venda",
  RESERVATION: "Reserva",
  RESERVATION_RELEASE: "Reserva liberada",
  RETURN: "Devolução",
  CANCELLATION: "Cancelamento",
  MANUAL_IN: "Entrada manual",
  MANUAL_OUT: "Saída manual",
  CORRECTION: "Correção",
};
