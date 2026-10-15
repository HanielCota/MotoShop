import { formatDateTime, formatMoneyInCents } from "@/lib/format";

/** Rótulos pt-BR das ações gravadas em `AuditLog.action` (UX-15). Ação nova sem rótulo aparece como está. */
export const auditActionLabels: Record<string, string> = {
  BRAND_ACTIVATED: "Marca ativada",
  BRAND_CREATED: "Marca criada",
  BRAND_DEACTIVATED: "Marca desativada",
  CANCELLATION_APPROVED: "Cancelamento aprovado",
  CANCELLATION_REFUNDED: "Reembolso de cancelamento",
  CANCELLATION_REJECTED: "Cancelamento recusado",
  CATEGORY_ACTIVATED: "Categoria ativada",
  CATEGORY_CREATED: "Categoria criada",
  CATEGORY_DEACTIVATED: "Categoria desativada",
  COUPON_CAMPAIGN_JOINED: "Loja entrou na campanha",
  COUPON_CAMPAIGN_LEFT: "Loja saiu da campanha",
  COUPON_CREATED: "Cupom criado",
  DISPUTE_REJECTED: "Disputa recusada",
  DISPUTE_RESOLVED: "Disputa resolvida",
  DISPUTE_UNDER_REVIEW: "Disputa em análise",
  MARKETPLACE_COMMISSION_UPDATED: "Comissão padrão alterada",
  MARKETPLACE_COUPON_ACTIVATED: "Cupom do Moto Shop ativado",
  MARKETPLACE_COUPON_DEACTIVATED: "Cupom do Moto Shop desativado",
  MOTORCYCLE_FITMENT_CREATED: "Ano de moto criado",
  MOTORCYCLE_MANUFACTURER_ACTIVATED: "Fabricante ativado",
  MOTORCYCLE_MANUFACTURER_CREATED: "Fabricante criado",
  MOTORCYCLE_MANUFACTURER_DEACTIVATED: "Fabricante desativado",
  MOTORCYCLE_MODEL_ACTIVATED: "Modelo de moto ativado",
  MOTORCYCLE_MODEL_CREATED: "Modelo de moto criado",
  MOTORCYCLE_MODEL_DEACTIVATED: "Modelo de moto desativado",
  NOTIFICATION_RESEND_REQUESTED: "Reenvio de notificação",
  ORDER_GUEST_CLAIMED: "Pedido de visitante vinculado à conta",
  ORDER_STATUS_CHANGED: "Status do pedido alterado",
  OWN_SHIPPING_CREATED: "Entrega própria criada",
  OWN_SHIPPING_STATUS_CHANGED: "Entrega própria atualizada",
  PRODUCT_APPROVED: "Produto aprovado",
  PRODUCT_ARCHIVED: "Produto arquivado",
  PRODUCT_COMMERCIAL_FIELDS_UPDATED: "Preço ou promoção alterados",
  PRODUCT_QUESTION_ANSWER_UPDATED: "Resposta de pergunta alterada",
  PRODUCT_REJECTED: "Produto recusado",
  PRODUCT_RESTORED: "Produto restaurado",
  PUBLIC_CONTENT_HIDDEN: "Conteúdo público ocultado",
  PUBLIC_CONTENT_RESTORED: "Conteúdo público restaurado",
  RETURN_APPROVED: "Devolução aprovada",
  RETURN_REFUNDED: "Reembolso de devolução",
  RETURN_REJECTED: "Devolução recusada",
  RETURN_RETURNED: "Devolução recebida",
  RETURN_UNDER_REVIEW: "Devolução em análise",
  SELLER_APPROVED: "Lojista aprovado",
  SELLER_COMMISSION_UPDATED: "Comissão da loja alterada",
  SELLER_COUPON_ACTIVATED: "Cupom da loja ativado",
  SELLER_COUPON_DEACTIVATED: "Cupom da loja desativado",
  SELLER_COUPON_SHOWN_ON_PRODUCT_PAGE: "Cupom exibido na página do produto",
  SELLER_MEMBER_ADDED: "Membro adicionado à equipe",
  SELLER_MEMBER_REMOVED: "Membro removido da equipe",
  SELLER_MEMBER_ROLE_UPDATED: "Perfil de membro alterado",
  SELLER_ORDER_STATUS_CHANGED: "Status do pedido da loja alterado",
  SELLER_REACTIVATED: "Lojista reativado",
  SELLER_REJECTED: "Lojista recusado",
  SELLER_SUSPENDED: "Lojista suspenso",
  SELLER_VIP_ACTIVATED: "VIP ativado",
  SELLER_VIP_RENEWED: "VIP renovado",
  SHIPMENT_GENERATION_RECONCILED: "Geração de etiqueta conferida",
  SHIPMENT_LABEL_CANCELLATION_CONFIRMED: "Cancelamento de etiqueta confirmado",
  SHIPMENT_LABEL_CANCELLATION_REQUIRED: "Etiqueta precisa ser cancelada",
  SHIPMENT_PURCHASE_RECONCILED: "Compra de etiqueta conferida",
  SHIPMENT_RESET_FOR_REPURCHASE: "Envio liberado para nova etiqueta",
  STORE_BRANDING_UPDATED: "Logo ou banner da loja alterados",
  STORE_PROFILE_UPDATED: "Perfil da loja alterado",
  STORE_SHIPPING_ORIGIN_UPDATED: "Origem dos envios alterada",
  WEBHOOK_RETRY_REQUESTED: "Reprocessamento de webhook",
};

/**
 * Tipos de registro como o Admin os entende. O código grava o mesmo conceito com grafias
 * diferentes (`ORDER` e `Order`), então cada grupo junta todas para o filtro, sem mexer nos dados.
 */
export const auditEntityGroups = [
  { value: "order", label: "Pedido", types: ["ORDER", "Order"] },
  { value: "seller-order", label: "Pedido da loja", types: ["SELLER_ORDER", "SellerOrder"] },
  { value: "cancellation", label: "Cancelamento", types: ["CANCELLATION_REQUEST", "CancellationRequest"] },
  { value: "return", label: "Devolução", types: ["RETURN_REQUEST", "ReturnRequest"] },
  { value: "dispute", label: "Disputa", types: ["DISPUTE", "Dispute"] },
  { value: "shipment", label: "Envio", types: ["SHIPMENT"] },
  { value: "shipping-method", label: "Modalidade de frete", types: ["SHIPPING_METHOD"] },
  { value: "seller", label: "Lojista", types: ["Seller"] },
  { value: "store", label: "Loja", types: ["STORE"] },
  { value: "seller-member", label: "Membro da equipe", types: ["SELLER_MEMBER", "SellerMember"] },
  { value: "subscription", label: "Plano VIP", types: ["SELLER_SUBSCRIPTION"] },
  { value: "product", label: "Produto", types: ["Product"] },
  { value: "question", label: "Pergunta", types: ["ProductQuestion"] },
  { value: "product-review", label: "Avaliação de produto", types: ["ProductReview"] },
  { value: "seller-review", label: "Avaliação de loja", types: ["SellerReview"] },
  { value: "coupon", label: "Cupom", types: ["Coupon"] },
  { value: "category", label: "Categoria", types: ["CATEGORY"] },
  { value: "brand", label: "Marca", types: ["BRAND"] },
  {
    value: "motorcycle",
    label: "Base de motos",
    types: ["MOTORCYCLE_MANUFACTURER", "MOTORCYCLE_MODEL", "MOTORCYCLE_FITMENT"],
  },
  { value: "configuration", label: "Configuração do Moto Shop", types: ["MarketplaceConfiguration"] },
  { value: "notification", label: "Notificação", types: ["NotificationDelivery"] },
  { value: "webhook", label: "Webhook", types: ["WebhookEvent"] },
] as const;

/** Grupo do filtro ou, para links antigos com o tipo cru, o próprio tipo. */
export function resolveAuditEntityTypes(value: string): readonly string[] {
  const group = auditEntityGroups.find((item) => item.value === value);
  return group ? group.types : [value];
}

export function getAuditActionLabel(action: string): string {
  return auditActionLabels[action] ?? action;
}

export function getAuditEntityLabel(entityType: string): string {
  const group = auditEntityGroups.find((item) => (item.types as readonly string[]).includes(entityType));
  return group?.label ?? entityType;
}

const metadataKeyLabels: Record<string, string> = {
  status: "Status",
  role: "Perfil",
  commissionBps: "Comissão",
  percentageBps: "Desconto",
  fixedAmountInCents: "Desconto fixo",
  minimumPurchaseInCents: "Compra mínima",
  amountInCents: "Valor",
  priceInCents: "Preço",
  promotionalPriceInCents: "Preço promocional",
  orderNumber: "Pedido",
  code: "Código",
  decision: "Decisão",
  note: "Observação",
  reason: "Motivo",
  months: "Meses",
  startsAt: "Início",
  endsAt: "Fim",
  provider: "Provedor",
  type: "Tipo",
  discountType: "Tipo de desconto",
  fundedBy: "Quem paga o desconto",
  ownerType: "Dono",
  answer: "Resposta",
  error: "Erro",
};

export type AuditMetadataLine = Readonly<{ label: string; value: string }>;

const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * Metadados em linhas legíveis: centavos em R$, basis points em %, datas formatadas,
 * pares anterior/novo juntos ("Comissão: 10% → 12%"). Vazios e IDs internos ficam de fora.
 */
export function formatAuditMetadata(metadata: unknown): AuditMetadataLine[] {
  if (!isRecord(metadata)) return [];

  const pairs = collectChangePairs(metadata);
  const lines: AuditMetadataLine[] = [];
  for (const [key, change] of pairs) {
    const previous = formatMetadataValue(key, change.previous);
    const next = formatMetadataValue(key, change.next);
    if (previous === null && next === null) continue;
    lines.push({ label: labelFor(key), value: `${previous ?? "—"} → ${next ?? "—"}` });
  }

  for (const [key, value] of Object.entries(metadata)) {
    if (isChangeKey(key) || isHiddenKey(key)) continue;
    const formatted = formatMetadataValue(key, value);
    if (formatted === null) continue;
    lines.push({ label: labelFor(key), value: formatted });
  }
  return lines;
}

type ChangePair = { previous: unknown; next: unknown };

/** `previousX`/`nextX` e os objetos `previous`/`next` (snapshot antes/depois) viram pares por campo. */
function collectChangePairs(metadata: Record<string, unknown>): Map<string, ChangePair> {
  const pairs = new Map<string, ChangePair>();
  const add = (key: string, side: keyof ChangePair, value: unknown) => {
    if (isHiddenKey(key)) return;
    const pair = pairs.get(key) ?? { previous: undefined, next: undefined };
    pairs.set(key, { ...pair, [side]: value });
  };

  for (const [key, value] of Object.entries(metadata)) {
    const prefixed = /^(previous|next|current)([A-Z]\w*)$/.exec(key);
    if (prefixed?.[1] && prefixed[2]) {
      add(lowerFirst(prefixed[2]), prefixed[1] === "previous" ? "previous" : "next", value);
      continue;
    }
    if ((key === "previous" || key === "next" || key === "current") && isRecord(value)) {
      for (const [field, fieldValue] of Object.entries(value))
        add(field, key === "previous" ? "previous" : "next", fieldValue);
    }
  }
  return pairs;
}

function isChangeKey(key: string): boolean {
  return /^(previous|next|current)([A-Z]\w*)?$/.test(key);
}

function isHiddenKey(key: string): boolean {
  return key === "id" || key.endsWith("Id") || key.endsWith("StorageKey") || key === "storageKey" || key === "tx";
}

function labelFor(key: string): string {
  return metadataKeyLabels[key] ?? key;
}

function formatMetadataValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number" && /InCents$|Cents$/.test(key)) return formatMoneyInCents(value);
  if (typeof value === "number" && /Bps$/.test(key)) return formatPercentFromBps(value);
  if (typeof value === "number") return String(value);
  if (typeof value === "string" && isoDatePattern.test(value)) return formatDateTime(value);
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

const percentFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function formatPercentFromBps(bps: number): string {
  return `${percentFormatter.format(bps / 100)}%`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}
