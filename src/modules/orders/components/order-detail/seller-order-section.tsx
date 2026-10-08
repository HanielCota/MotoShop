import { randomUUID } from "node:crypto";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { InlineNotice } from "@/components/ui/inline-notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMoneyInCents } from "@/lib/format";
import { canOpenDispute } from "@/modules/disputes/domain/dispute-eligibility";
import { RequestDisputeForm } from "@/modules/disputes/components/request-dispute-form";
import { RequestCancellationForm } from "@/modules/returns/components/request-cancellation-form";
import { RequestReturnForm } from "@/modules/returns/components/request-return-form";
import { canRequestCancellation } from "@/modules/returns/domain/cancellation-eligibility";
import { canRequestReturn, getReturnableQuantity } from "@/modules/returns/domain/return-eligibility";
import { ReviewForm } from "@/modules/reviews/components/review-form";
import { getStatusLabel } from "@/shared/presentation/status-labels";

import { ShipmentTracking } from "./shipment-tracking";
import type { CustomerOrderItem, CustomerSellerOrder } from "./types";
import { Disclosure } from "@/components/ui/disclosure";

type SellerOrderSectionProps = {
  orderNumber: string;
  sellerOrder: CustomerSellerOrder;
  accessToken?: string;
  /** Avaliações exigem conta: só aparecem para o cliente logado dono do pedido. */
  canReview: boolean;
  sellerAlreadyReviewed: boolean;
};

export function SellerOrderSection({
  orderNumber,
  sellerOrder,
  accessToken,
  canReview,
  sellerAlreadyReviewed,
}: SellerOrderSectionProps) {
  const tokenProps = accessToken ? { accessToken } : {};
  const latestCancellation = sellerOrder.cancellationRequests.at(-1);
  const latestDispute = sellerOrder.disputes.at(-1);
  const returnStatuses = sellerOrder.items.flatMap((item) => item.returnItems.map((r) => r.returnRequest.status));
  const cancellationAllowed = canRequestCancellation({
    sellerOrderStatus: sellerOrder.status,
    shipmentStatus: sellerOrder.shipment?.status ?? null,
    cancellationStatuses: sellerOrder.cancellationRequests.map((request) => request.status),
    returnStatuses,
  });
  const disputeAllowed = canOpenDispute({
    sellerOrderStatus: sellerOrder.status,
    disputeStatuses: sellerOrder.disputes.map((dispute) => dispute.status),
  });
  const reviewableItems = sellerOrder.items.filter(
    (item) => canReview && sellerOrder.status === "DELIVERED" && isReviewable(item),
  );
  const awaitingDelivery = ["PAID", "PROCESSING", "SHIPPED"].includes(sellerOrder.status);

  return (
    <Card>
      <CardHeader className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <h3 className="text-foreground text-lg font-semibold">{sellerOrder.storeNameSnapshot}</h3>
          <p className="text-muted-foreground text-sm">
            {sellerOrder.items.length} {sellerOrder.items.length === 1 ? "item" : "itens"} · Frete{" "}
            {formatMoneyInCents(sellerOrder.customerShippingAmountInCents)}
          </p>
        </div>
        <StatusBadge domain="sellerOrder" status={sellerOrder.status} />
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {latestCancellation ? (
          <InlineNotice tone={latestCancellation.status === "REJECTED" ? "info" : "warning"} role="status">
            <span className="inline-flex flex-wrap items-center gap-2">
              Solicitação de cancelamento
              <StatusBadge domain="cancellation" status={latestCancellation.status} />
            </span>
          </InlineNotice>
        ) : null}
        {latestDispute ? (
          <InlineNotice tone="warning" role="status">
            <span className="inline-flex flex-wrap items-center gap-2">
              Disputa com mediação do Moto Shop
              <StatusBadge domain="dispute" status={latestDispute.status} />
            </span>
          </InlineNotice>
        ) : null}

        <ShipmentTracking shipment={sellerOrder.shipment} />

        <div>
          <h4 className="text-foreground mb-2 text-sm font-semibold">Itens</h4>
          <ul className="divide-border flex flex-col divide-y">
            {sellerOrder.items.map((item) => (
              <OrderItemRow
                key={item.id}
                item={item}
                orderNumber={orderNumber}
                sellerOrderStatus={sellerOrder.status}
                tokenProps={tokenProps}
                showReview={reviewableItems.includes(item)}
                // A nota da loja é pedida uma única vez: no primeiro item ainda avaliável.
                sellerAlreadyReviewed={sellerAlreadyReviewed || reviewableItems[0] !== item}
              />
            ))}
          </ul>
        </div>

        {cancellationAllowed || disputeAllowed || awaitingDelivery ? (
          <div className="border-border space-y-3 border-t pt-4">
            <h4 className="text-foreground text-sm font-semibold">Precisa de ajuda com este pedido?</h4>
            {awaitingDelivery ? (
              <p className="text-muted-foreground text-sm">
                A devolução fica disponível após a entrega.
                {cancellationAllowed ? " Antes do envio, você pode solicitar o cancelamento." : ""}
              </p>
            ) : null}
            {cancellationAllowed ? (
              <RequestCancellationForm orderNumber={orderNumber} sellerOrderId={sellerOrder.id} {...tokenProps} />
            ) : null}
            {disputeAllowed ? (
              <Disclosure summary="Abrir disputa">
                <RequestDisputeForm orderNumber={orderNumber} sellerOrderId={sellerOrder.id} {...tokenProps} />
              </Disclosure>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function isReviewable(item: CustomerOrderItem): boolean {
  return !item.productReview && !item.returnItems.some((returnItem) => returnItem.returnRequest.status === "REFUNDED");
}

function OrderItemRow({
  item,
  orderNumber,
  sellerOrderStatus,
  tokenProps,
  showReview,
  sellerAlreadyReviewed,
}: {
  item: CustomerOrderItem;
  orderNumber: string;
  sellerOrderStatus: string;
  tokenProps: { accessToken?: string };
  showReview: boolean;
  sellerAlreadyReviewed: boolean;
}) {
  const latestReturn = item.returnItems.at(-1)?.returnRequest;
  const returnAllowed = canRequestReturn({ sellerOrderStatus, item });

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <p className="text-foreground font-medium">{item.productNameSnapshot}</p>
          <p className="text-muted-foreground text-sm">
            {item.variantDescriptionSnapshot} · SKU {item.skuSnapshot} · Qtd. {item.quantity}
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <span className="text-foreground font-medium">{formatMoneyInCents(item.totalAmountInCents)}</span>
          {latestReturn ? (
            <StatusBadge
              domain="return"
              status={latestReturn.status}
              label={`Devolução: ${getStatusLabel("return", latestReturn.status)}`}
            />
          ) : null}
        </div>
      </div>
      {returnAllowed || showReview ? (
        <div className="flex flex-col gap-3">
          {showReview ? (
            <Disclosure summary="Avaliar produto">
              <ReviewForm orderItemId={item.id} sellerAlreadyReviewed={sellerAlreadyReviewed} />
            </Disclosure>
          ) : null}
          {returnAllowed ? (
            <Disclosure summary="Solicitar devolução">
              <RequestReturnForm
                orderNumber={orderNumber}
                orderItemId={item.id}
                maxQuantity={getReturnableQuantity(item)}
                idempotencyKey={randomUUID()}
                {...tokenProps}
              />
            </Disclosure>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
