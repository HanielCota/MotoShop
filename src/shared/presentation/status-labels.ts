/**
 * Fonte única de rótulos (pt-BR) e tons visuais para os status do domínio.
 * Páginas e componentes não devem declarar mapas próprios: use `getStatusPresentation`
 * ou o componente `StatusBadge`.
 */
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

/**
 * What the status means, which picks its icon (IC-01): the icon follows the meaning, the tone only
 * the color. waiting = depends on someone else; done = finished well; transit = on the way;
 * attention = needs action; failed = refused, failed or cancelled; idle = not started or archived.
 */
export type StatusMeaning = "waiting" | "done" | "transit" | "attention" | "failed" | "idle";

export type StatusPresentation = { label: string; tone: StatusTone; meaning: StatusMeaning };

type StatusMap = Record<string, StatusPresentation>;

const order: StatusMap = {
  PENDING_PAYMENT: { label: "Aguardando pagamento", tone: "warning", meaning: "waiting" },
  PAID: { label: "Pago", tone: "info", meaning: "done" },
  PROCESSING: { label: "Em preparação", tone: "info", meaning: "waiting" },
  PARTIALLY_SHIPPED: { label: "Parcialmente enviado", tone: "info", meaning: "transit" },
  SHIPPED: { label: "Enviado", tone: "brand", meaning: "transit" },
  DELIVERED: { label: "Entregue", tone: "success", meaning: "done" },
  PARTIALLY_CANCELLED: { label: "Parcialmente cancelado", tone: "warning", meaning: "attention" },
  CANCELLATION_REQUESTED: { label: "Cancelamento em análise", tone: "warning", meaning: "waiting" },
  CANCELLED: { label: "Cancelado", tone: "danger", meaning: "failed" },
};

const shipment: StatusMap = {
  PENDING: { label: "Aguardando envio", tone: "neutral", meaning: "waiting" },
  READY_TO_SHIP: { label: "Etiqueta pronta", tone: "info", meaning: "done" },
  SHIPPED: { label: "Postado", tone: "brand", meaning: "transit" },
  IN_TRANSIT: { label: "Em trânsito", tone: "brand", meaning: "transit" },
  DELIVERED: { label: "Entregue", tone: "success", meaning: "done" },
  EXCEPTION: { label: "Problema no envio", tone: "danger", meaning: "attention" },
  CANCELLED: { label: "Envio cancelado", tone: "danger", meaning: "failed" },
};

const payment: StatusMap = {
  PENDING: { label: "Pendente", tone: "warning", meaning: "waiting" },
  PROCESSING: { label: "Processando", tone: "info", meaning: "waiting" },
  AUTHORIZED: { label: "Autorizado", tone: "info", meaning: "waiting" },
  APPROVED: { label: "Aprovado", tone: "success", meaning: "done" },
  FAILED: { label: "Recusado", tone: "danger", meaning: "failed" },
  CANCELLED: { label: "Cancelado", tone: "danger", meaning: "failed" },
  PARTIALLY_REFUNDED: { label: "Parcialmente reembolsado", tone: "warning", meaning: "done" },
  REFUNDED: { label: "Reembolsado", tone: "neutral", meaning: "done" },
};

const returnRequest: StatusMap = {
  REQUESTED: { label: "Solicitada", tone: "warning", meaning: "waiting" },
  UNDER_REVIEW: { label: "Em análise", tone: "info", meaning: "waiting" },
  APPROVED: { label: "Aprovada", tone: "info", meaning: "done" },
  WAITING_RETURN: { label: "Aguardando postagem", tone: "info", meaning: "waiting" },
  RETURNED: { label: "Recebida pela loja", tone: "brand", meaning: "done" },
  REFUNDED: { label: "Reembolsada", tone: "success", meaning: "done" },
  REJECTED: { label: "Recusada", tone: "danger", meaning: "failed" },
};

const cancellation: StatusMap = {
  REQUESTED: { label: "Solicitado", tone: "warning", meaning: "waiting" },
  APPROVED: { label: "Aprovado", tone: "info", meaning: "done" },
  REFUNDED: { label: "Reembolsado", tone: "success", meaning: "done" },
  REJECTED: { label: "Recusado", tone: "danger", meaning: "failed" },
};

const dispute: StatusMap = {
  OPEN: { label: "Aberta", tone: "warning", meaning: "waiting" },
  UNDER_REVIEW: { label: "Em análise", tone: "info", meaning: "waiting" },
  RESOLVED: { label: "Resolvida", tone: "success", meaning: "done" },
  REJECTED: { label: "Rejeitada", tone: "danger", meaning: "failed" },
};

const seller: StatusMap = {
  PENDING: { label: "Em análise", tone: "warning", meaning: "waiting" },
  APPROVED: { label: "Aprovado", tone: "success", meaning: "done" },
  ACTIVE: { label: "Ativo", tone: "success", meaning: "done" },
  SUSPENDED: { label: "Suspenso", tone: "warning", meaning: "attention" },
  BLOCKED: { label: "Bloqueado", tone: "danger", meaning: "failed" },
  REJECTED: { label: "Recusado", tone: "danger", meaning: "failed" },
};

const product: StatusMap = {
  DRAFT: { label: "Rascunho", tone: "neutral", meaning: "idle" },
  SUBMITTED: { label: "Em análise", tone: "warning", meaning: "waiting" },
  APPROVED: { label: "Publicado", tone: "success", meaning: "done" },
  REJECTED: { label: "Recusado", tone: "danger", meaning: "failed" },
  ARCHIVED: { label: "Arquivado", tone: "neutral", meaning: "idle" },
};

const webhook: StatusMap = {
  RECEIVED: { label: "Recebido", tone: "neutral", meaning: "idle" },
  PROCESSING: { label: "Processando", tone: "info", meaning: "waiting" },
  PROCESSED: { label: "Processado", tone: "success", meaning: "done" },
  FAILED: { label: "Falhou", tone: "danger", meaning: "failed" },
};

const notification: StatusMap = {
  PROCESSING: { label: "Processando", tone: "info", meaning: "waiting" },
  SENT: { label: "Enviado", tone: "success", meaning: "done" },
  FAILED: { label: "Falhou", tone: "danger", meaning: "failed" },
};

const outbox: StatusMap = {
  PENDING: { label: "Pendente", tone: "warning", meaning: "waiting" },
  PROCESSING: { label: "Processando", tone: "info", meaning: "waiting" },
  DISPATCHED: { label: "Despachado", tone: "success", meaning: "done" },
  FAILED: { label: "Falhou", tone: "danger", meaning: "failed" },
};

const subscription: StatusMap = {
  ACTIVE: { label: "Ativa", tone: "success", meaning: "done" },
  PAST_DUE: { label: "Em atraso", tone: "warning", meaning: "attention" },
  CANCELLED: { label: "Cancelada", tone: "danger", meaning: "failed" },
  EXPIRED: { label: "Expirada", tone: "neutral", meaning: "idle" },
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
  return statusMaps[domain][status] ?? { label: humanizeStatus(status), tone: "neutral", meaning: "idle" };
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
