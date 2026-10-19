import type { ReactNode } from "react";

import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatMoneyInCents } from "@/lib/format";
import { disputeReasonLabels, returnReasonLabels, type StatusDomain } from "@/shared/presentation/status-labels";

// Só o que o lojista pode ver: as notas internas do Admin nunca chegam aqui (UX-13).
type OrderItemSummary = { id: string; quantity: number; productNameSnapshot: string; skuSnapshot: string };
type CancellationSummary = {
  id: string;
  status: string;
  reason: string;
  customerMessage: string | null;
  createdAt: Date;
};
type ReturnSummary = {
  id: string;
  status: string;
  reason: string;
  customerMessage: string | null;
  amountInCents: number;
  createdAt: Date;
  items: readonly {
    id: string;
    quantity: number;
    orderItem: { productNameSnapshot: string; skuSnapshot: string };
  }[];
};
type DisputeSummary = { id: string; status: string; reason: string; description: string; createdAt: Date };

export type SellerOrderAfterSalesData = {
  items: readonly OrderItemSummary[];
  cancellationRequests: readonly CancellationSummary[];
  returnRequests: readonly ReturnSummary[];
  disputes: readonly DisputeSummary[];
};

type Detail = readonly [label: string, value: string | null];

const OPEN_CANCELLATION_STATUSES = new Set(["REQUESTED", "APPROVED"]);
const OPEN_RETURN_STATUSES = new Set(["REQUESTED", "UNDER_REVIEW", "APPROVED", "WAITING_RETURN", "RETURNED"]);
const OPEN_DISPUTE_STATUSES = new Set(["OPEN", "UNDER_REVIEW"]);
const cancellationReasonLabels: Record<string, string> = { CUSTOMER_REQUEST: "Pedido do cliente" };

/** Cancelamentos, devoluções e disputas da parte do pedido da loja, sem ações: quem decide é o Moto Shop. */
export function SellerOrderAfterSales({ order }: { order: SellerOrderAfterSalesData }) {
  const total = order.cancellationRequests.length + order.returnRequests.length + order.disputes.length;

  if (total === 0) return null;

  const orderItems = describeItems(order.items.map(toItemLine));

  return (
    <section aria-label="Pós-venda" className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold">
        Pós-venda <span className="text-muted-foreground font-normal">· acompanhamento, a decisão é do Moto Shop</span>
      </h4>
      {order.cancellationRequests.map((request) => (
        <CancellationBlock key={request.id} request={request} orderItems={orderItems} />
      ))}
      {order.returnRequests.map((request) => (
        <ReturnBlock key={request.id} request={request} />
      ))}
      {order.disputes.map((dispute) => (
        <DisputeBlock key={dispute.id} dispute={dispute} orderItems={orderItems} />
      ))}
    </section>
  );
}

function CancellationBlock({ request, orderItems }: { request: CancellationSummary; orderItems: string }) {
  return (
    <AfterSalesBlock
      title="Cancelamento"
      domain="cancellation"
      status={request.status}
      details={[
        ["Itens", orderItems],
        ["Motivo", cancellationReasonLabels[request.reason] ?? request.reason],
        ["Mensagem do cliente", hasText(request.customerMessage) ? `"${request.customerMessage}"` : null],
        ["Aberto em", formatDate(request.createdAt)],
      ]}
      footer={
        OPEN_CANCELLATION_STATUSES.has(request.status) ? (
          <>
            <strong>Não despache este pedido</strong> enquanto o Moto Shop analisa.
          </>
        ) : null
      }
    />
  );
}

function ReturnBlock({ request }: { request: ReturnSummary }) {
  const items = request.items.map((item) => toItemLine({ ...item.orderItem, quantity: item.quantity }));

  return (
    <AfterSalesBlock
      title="Devolução"
      domain="return"
      status={request.status}
      details={[
        ["Itens", describeItems(items)],
        ["Motivo", returnReasonLabels[request.reason] ?? request.reason],
        ["Mensagem do cliente", request.customerMessage],
        ["Valor estimado", formatMoneyInCents(request.amountInCents)],
        ["Aberta em", formatDate(request.createdAt)],
      ]}
      footer={
        OPEN_RETURN_STATUSES.has(request.status)
          ? "O Moto Shop acompanha a devolução e avisa a loja a cada etapa."
          : null
      }
    />
  );
}

function DisputeBlock({ dispute, orderItems }: { dispute: DisputeSummary; orderItems: string }) {
  return (
    <AfterSalesBlock
      title="Disputa"
      domain="dispute"
      status={dispute.status}
      details={[
        ["Itens", orderItems],
        ["Motivo", disputeReasonLabels[dispute.reason] ?? dispute.reason],
        ["Relato do cliente", dispute.description],
        ["Aberta em", formatDate(dispute.createdAt)],
      ]}
      footer={
        OPEN_DISPUTE_STATUSES.has(dispute.status)
          ? "A equipe do Moto Shop faz a mediação e pode pedir informações à loja."
          : null
      }
    />
  );
}

function AfterSalesBlock({
  title,
  domain,
  status,
  details,
  footer,
}: {
  title: string;
  domain: StatusDomain;
  status: string;
  details: readonly Detail[];
  footer: ReactNode;
}) {
  return (
    <div className="bg-surface-sunken flex flex-col gap-1 rounded-lg p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h5 className="font-semibold">{title}</h5>
        <StatusBadge domain={domain} status={status} />
      </div>
      <dl className="grid gap-1">
        {details.map(([label, value]) =>
          hasText(value) ? (
            <div key={label} className="text-muted-foreground break-words">
              <dt className="text-foreground inline font-medium">{label}:</dt> <dd className="inline">{value}</dd>
            </div>
          ) : null,
        )}
      </dl>
      {footer ? <p className="mt-1">{footer}</p> : null}
    </div>
  );
}

function toItemLine(item: { quantity: number; productNameSnapshot: string; skuSnapshot: string }): string {
  return `${item.quantity} × ${item.productNameSnapshot} · SKU ${item.skuSnapshot}`;
}

function describeItems(lines: readonly string[]): string {
  return lines.join("; ");
}

/** A detail with only spaces says nothing, so it is left out like an empty one. */
function hasText(value: string | null): value is string {
  return value != null && value.trim().length > 0;
}
