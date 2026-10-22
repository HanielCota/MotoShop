import type { ReactNode } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime, formatMoneyInCents } from "@/lib/format";
import { DisputeStatusActions } from "@/modules/disputes/components/dispute-status-actions";
import { ShipmentTracking } from "@/modules/orders/components/order-detail/shipment-tracking";
import { CancellationStatusActions } from "@/modules/returns/components/cancellation-status-actions";
import { ReturnPhotoGallery } from "@/modules/returns/components/return-photo-gallery";
import { ReturnStatusActions } from "@/modules/returns/components/return-status-actions";
import { returnReasonLabels, type StatusDomain } from "@/shared/presentation/status-labels";

import type { AdminOrderSellerOrder } from "../../queries/order-detail";

/** Parte do pedido de uma loja, com as solicitações de pós-venda e as mesmas ações das filas. */
export function AdminSellerOrderCard({
  orderNumber,
  sellerOrder,
}: {
  orderNumber: string;
  sellerOrder: AdminOrderSellerOrder;
}) {
  const summary = { orderNumber, storeName: sellerOrder.storeNameSnapshot };
  const hasAfterSales =
    sellerOrder.cancellationRequests.length + sellerOrder.returnRequests.length + sellerOrder.disputes.length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <h3 className="text-foreground text-lg font-semibold">{sellerOrder.storeNameSnapshot}</h3>
          <p className="text-muted-foreground text-sm">
            Itens {formatMoneyInCents(sellerOrder.itemsSubtotalInCents)} · Frete{" "}
            {formatMoneyInCents(sellerOrder.customerShippingAmountInCents)}
            {sellerOrder.discountAmountInCents > 0
              ? ` · Desconto ${formatMoneyInCents(sellerOrder.discountAmountInCents)}`
              : ""}
          </p>
        </div>
        <StatusBadge domain="sellerOrder" status={sellerOrder.status} />
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ul className="divide-border divide-y text-sm">
          {sellerOrder.items.map((item) => (
            <li key={item.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span className="min-w-0 break-words">
                {item.quantity} × {item.productNameSnapshot} · {item.variantDescriptionSnapshot} · SKU{" "}
                {item.skuSnapshot}
              </span>
              <span className="tabular-nums">{formatMoneyInCents(item.totalAmountInCents)}</span>
            </li>
          ))}
        </ul>

        <ShipmentTracking shipment={sellerOrder.shipment} />

        {hasAfterSales ? (
          <section aria-label="Pós-venda" className="space-y-3">
            {sellerOrder.cancellationRequests.map((request) => (
              <AfterSalesRequest
                key={request.id}
                title="Cancelamento"
                domain="cancellation"
                status={request.status}
                createdAt={request.createdAt}
                details={[
                  `Valor ${formatMoneyInCents(request.amountInCents)}`,
                  `Motivo: ${request.customerMessage ?? "não informado"}`,
                  request.adminNote ? `Nota: ${request.adminNote}` : null,
                ]}
                actions={
                  request.status === "REQUESTED" || request.status === "APPROVED" ? (
                    <CancellationStatusActions
                      cancellationRequestId={request.id}
                      status={request.status}
                      summary={{ ...summary, amountInCents: request.amountInCents }}
                    />
                  ) : null
                }
              />
            ))}
            {sellerOrder.returnRequests.map((request) => (
              <AfterSalesRequest
                key={request.id}
                title="Devolução"
                domain="return"
                status={request.status}
                createdAt={request.createdAt}
                details={[
                  request.items
                    .map(
                      (item) =>
                        `${item.quantity} × ${item.orderItem.productNameSnapshot} (${item.orderItem.skuSnapshot})`,
                    )
                    .join(" · "),
                  `Valor estimado ${formatMoneyInCents(request.amountInCents)}`,
                  `Motivo: ${returnReasonLabels[request.reason] ?? request.reason}${request.customerMessage ? ` · ${request.customerMessage}` : ""}`,
                  request.adminNote ? `Nota: ${request.adminNote}` : null,
                ]}
                extra={<ReturnPhotoGallery photos={request.photos} title="Fotos do cliente" />}
                actions={
                  <ReturnStatusActions
                    returnRequestId={request.id}
                    status={request.status}
                    summary={{ ...summary, amountInCents: request.amountInCents }}
                  />
                }
              />
            ))}
            {sellerOrder.disputes.map((dispute) => (
              <AfterSalesRequest
                key={dispute.id}
                title="Disputa"
                domain="dispute"
                status={dispute.status}
                createdAt={dispute.createdAt}
                details={[
                  dispute.reason,
                  dispute.description,
                  dispute.resolutionNote ? `Resolução: ${dispute.resolutionNote}` : null,
                ]}
                actions={<DisputeStatusActions disputeId={dispute.id} status={dispute.status} summary={summary} />}
              />
            ))}
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AfterSalesRequest({
  title,
  domain,
  status,
  createdAt,
  details,
  extra,
  actions,
}: {
  title: string;
  domain: StatusDomain;
  status: string;
  createdAt: Date;
  details: readonly (string | null)[];
  extra?: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="bg-surface-sunken flex flex-col gap-3 rounded-lg p-3 text-sm lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-semibold">{title}</h4>
          <StatusBadge domain={domain} status={status} />
        </div>
        {details
          .filter((detail): detail is string => Boolean(detail))
          .map((detail) => (
            <p key={detail} className="text-muted-foreground break-words whitespace-pre-wrap">
              {detail}
            </p>
          ))}
        {extra}
        <p className="text-muted-foreground text-xs">Aberta em {formatDateTime(createdAt)}</p>
      </div>
      {actions}
    </div>
  );
}
