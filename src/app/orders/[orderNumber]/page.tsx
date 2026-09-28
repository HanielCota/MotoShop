import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyInCents } from "@/lib/utils";
import { InlineNotice } from "@/components/ui/inline-notice";
import { getCurrentSession } from "@/modules/auth/application/authorization";
import { hashGuestToken } from "@/modules/cart/infrastructure/cart-access";
import { RequestDisputeForm } from "@/modules/disputes/components/request-dispute-form";
import { ReviewForm } from "@/modules/reviews/components/review-form";
import { RequestCancellationForm } from "@/modules/returns/components/request-cancellation-form";
import { RequestReturnForm } from "@/modules/returns/components/request-return-form";
import { getCustomerOrder } from "@/modules/returns/queries/customer-orders";
import { PaymentRefreshForm } from "@/modules/payments/components/payment-refresh-form";
import { PixPaymentInstructions } from "@/modules/payments/components/pix-payment-instructions";
import { getPixInstructions } from "@/modules/payments/domain/pix-instructions";
import { ClaimGuestOrderForm } from "@/modules/orders/components/claim-guest-order-form";

const orderStatusLabels: Record<string, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  PROCESSING: "Em processamento",
  PARTIALLY_SHIPPED: "Parcialmente enviado",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  PARTIALLY_CANCELLED: "Parcialmente cancelado",
  CANCELLED: "Cancelado",
  CANCELLATION_REQUESTED: "Cancelamento em análise",
};

const disputeStatusLabels: Record<string, string> = {
  OPEN: "Aberta",
  UNDER_REVIEW: "Em análise",
  RESOLVED: "Resolvida",
  REJECTED: "Rejeitada",
};

const shipmentStatusLabels: Record<string, string> = {
  PENDING: "Aguardando envio",
  READY_TO_SHIP: "Etiqueta pronta",
  SHIPPED: "Postado",
  IN_TRANSIT: "Em trânsito",
  DELIVERED: "Entregue",
  EXCEPTION: "Problema no envio",
  CANCELLED: "Envio cancelado",
};

const returnStatusLabels: Record<string, string> = {
  REQUESTED: "Solicitada",
  UNDER_REVIEW: "Em análise",
  APPROVED: "Aprovada",
  WAITING_RETURN: "Aguardando postagem",
  RETURNED: "Recebida pela loja",
  REFUNDED: "Reembolsada",
  REJECTED: "Recusada",
};

const paymentStatusLabels: Record<string, string> = {
  PENDING: "Pendente",
  PROCESSING: "Processando",
  AUTHORIZED: "Autorizado",
  APPROVED: "Aprovado",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
  PARTIALLY_REFUNDED: "Parcialmente reembolsado",
  REFUNDED: "Reembolsado",
};

const activeReturnStatuses = new Set([
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
  "WAITING_RETURN",
  "RETURNED",
  "REFUNDED",
]);
const shipmentProgress = ["PENDING", "READY_TO_SHIP", "SHIPPED", "IN_TRANSIT", "DELIVERED"] as const;

export default async function CustomerOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ accessToken?: string }>;
}) {
  const [{ orderNumber }, { accessToken }] = await Promise.all([params, searchParams]);
  const session = await getCurrentSession();
  const identity = accessToken
    ? { guestAccessTokenHash: hashGuestToken(accessToken) }
    : session
      ? { userId: session.user.id }
      : null;
  if (!identity) notFound();

  const order =
    (await getCustomerOrder(orderNumber, identity)) ??
    (accessToken && session ? await getCustomerOrder(orderNumber, { userId: session.user.id }) : null);
  if (!order) notFound();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div>
        <Badge variant="secondary">Pedido</Badge>
        <h1 className="mt-2 text-3xl font-semibold">{order.orderNumber}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Criado em {new Intl.DateTimeFormat("pt-BR").format(order.createdAt)} ·{" "}
          {orderStatusLabels[order.status] ?? order.status}
        </p>
      </div>

      {session &&
      accessToken &&
      !order.userId &&
      session.user.email.toLowerCase() === order.customerEmail.toLowerCase() ? (
        <ClaimGuestOrderForm orderNumber={order.orderNumber} accessToken={accessToken} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Resumo da compra</CardTitle>
          <CardDescription>Total do pedido: {formatMoneyInCents(order.totalAmountInCents)}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {order.sellerOrders.map((sellerOrder) => (
            <section key={sellerOrder.id} className="border-border flex flex-col gap-4 rounded-lg border p-4">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-medium">{sellerOrder.storeNameSnapshot}</h2>
                  <p className="text-muted-foreground text-sm">
                    {sellerOrder.items.length} item(ns) ·{" "}
                    {formatMoneyInCents(sellerOrder.customerShippingAmountInCents)} de frete
                  </p>
                </div>
                <Badge variant="outline">{orderStatusLabels[sellerOrder.status] ?? sellerOrder.status}</Badge>
              </div>

              {sellerOrder.cancellationRequests.at(-1) ? (
                <InlineNotice tone="error" role="status">
                  Solicitação de cancelamento: {sellerOrder.cancellationRequests.at(-1)?.status}
                </InlineNotice>
              ) : null}

              {sellerOrder.disputes.at(-1) ? (
                <InlineNotice tone="warning">
                  Disputa:{" "}
                  {disputeStatusLabels[sellerOrder.disputes.at(-1)?.status ?? ""] ??
                    sellerOrder.disputes.at(-1)?.status}
                </InlineNotice>
              ) : null}

              {sellerOrder.shipment ? (
                <div className="bg-muted/40 rounded-md p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>Envio</strong>
                    <Badge variant="secondary">
                      {shipmentStatusLabels[sellerOrder.shipment.status] ?? sellerOrder.shipment.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    {sellerOrder.shipment.carrier} · {sellerOrder.shipment.service}
                    {sellerOrder.shipment.trackingCode ? ` · ${sellerOrder.shipment.trackingCode}` : ""}
                  </p>
                  {sellerOrder.shipment.trackingUrl ? (
                    <a
                      className="text-primary mt-1 inline-block underline"
                      href={sellerOrder.shipment.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Acompanhar entrega
                    </a>
                  ) : null}
                  <ShipmentTimeline status={sellerOrder.shipment.status} />
                </div>
              ) : null}

              {(session || accessToken) &&
              ["PAID", "PROCESSING"].includes(sellerOrder.status) &&
              !sellerOrder.cancellationRequests.some((request) =>
                ["REQUESTED", "APPROVED", "REFUNDED"].includes(request.status),
              ) ? (
                <RequestCancellationForm
                  orderNumber={order.orderNumber}
                  sellerOrderId={sellerOrder.id}
                  {...(accessToken ? { accessToken } : {})}
                />
              ) : null}

              {(session || accessToken) &&
              !sellerOrder.disputes.some((dispute) => ["OPEN", "UNDER_REVIEW"].includes(dispute.status)) &&
              !["PENDING_PAYMENT", "CANCELLED", "CANCELLATION_REQUESTED"].includes(sellerOrder.status) ? (
                <RequestDisputeForm
                  orderNumber={order.orderNumber}
                  sellerOrderId={sellerOrder.id}
                  {...(accessToken ? { accessToken } : {})}
                />
              ) : null}

              <div className="flex flex-col gap-4">
                {sellerOrder.items.map((item, itemIndex) => {
                  const requestedQuantity = item.returnItems
                    .filter((returnItem) => activeReturnStatuses.has(returnItem.returnRequest.status))
                    .reduce((total, returnItem) => total + returnItem.quantity, 0);
                  const availableReturnQuantity = item.quantity - requestedQuantity;
                  const canRequestReturn =
                    ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(sellerOrder.status) &&
                    availableReturnQuantity > 0;
                  const latestReturn = item.returnItems.at(-1)?.returnRequest;

                  return (
                    <div key={item.id} className="border-border border-b pb-4 last:border-b-0 last:pb-0">
                      <div className="flex flex-col justify-between gap-2 sm:flex-row">
                        <div>
                          <p className="font-medium">{item.productNameSnapshot}</p>
                          <p className="text-muted-foreground text-sm">
                            {item.variantDescriptionSnapshot} · SKU {item.skuSnapshot} · Qtd. {item.quantity}
                          </p>
                          <p className="text-muted-foreground text-sm">{formatMoneyInCents(item.totalAmountInCents)}</p>
                        </div>
                        {latestReturn ? (
                          <Badge variant={latestReturn.status === "REJECTED" ? "destructive" : "secondary"}>
                            Devolução: {returnStatusLabels[latestReturn.status] ?? latestReturn.status}
                          </Badge>
                        ) : null}
                      </div>
                      {canRequestReturn ? (
                        <RequestReturnForm
                          orderNumber={order.orderNumber}
                          orderItemId={item.id}
                          maxQuantity={availableReturnQuantity}
                          idempotencyKey={randomUUID()}
                          {...(accessToken ? { accessToken } : {})}
                        />
                      ) : null}
                      {session && sellerOrder.status === "DELIVERED" && !item.productReview ? (
                        <ReviewForm
                          orderItemId={item.id}
                          sellerAlreadyReviewed={
                            itemIndex > 0 ||
                            order.sellerReviews.some((review) => review.sellerId === sellerOrder.sellerId)
                          }
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagamento</CardTitle>
          <CardDescription>Histórico de status e transações do pedido.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {order.payments.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum pagamento registrado.</p>
          ) : (
            order.payments.map((payment) => {
              const pixInstructions = getPixInstructions(payment);
              return (
                <div key={payment.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{payment.method ?? payment.provider}</p>
                      <p className="text-muted-foreground text-sm">
                        {formatMoneyInCents(payment.amountInCents)} ·{" "}
                        {new Intl.DateTimeFormat("pt-BR").format(payment.createdAt)}
                      </p>
                    </div>
                    <Badge
                      variant={
                        payment.status === "FAILED" || payment.status === "CANCELLED" ? "destructive" : "secondary"
                      }
                    >
                      {paymentStatusLabels[payment.status] ?? payment.status}
                    </Badge>
                  </div>
                  {pixInstructions ? <PixPaymentInstructions {...pixInstructions} /> : null}
                  {payment.method === "pix" &&
                  ["PENDING", "PROCESSING"].includes(payment.status) &&
                  !pixInstructions ? (
                    <p className="text-muted-foreground mt-3 text-sm">
                      O código Pix ainda não está disponível. Consulte o status em instantes.
                    </p>
                  ) : null}
                  {payment.transactions.length > 0 ? (
                    <ul className="text-muted-foreground mt-3 space-y-1 text-xs">
                      {payment.transactions.map((transaction) => (
                        <li key={transaction.id}>
                          {transaction.type} · {transaction.status} ·{" "}
                          {new Intl.DateTimeFormat("pt-BR").format(transaction.createdAt)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {["PENDING", "PROCESSING", "AUTHORIZED"].includes(payment.status) ? (
                    <div className="mt-3">
                      <PaymentRefreshForm orderNumber={order.orderNumber} {...(accessToken ? { accessToken } : {})} />
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function ShipmentTimeline({ status }: { status: string }) {
  const currentIndex = shipmentProgress.indexOf(status as (typeof shipmentProgress)[number]);
  const hasProblem = status === "EXCEPTION" || status === "CANCELLED";

  return (
    <div className="mt-4 border-t pt-4" aria-label="Progresso do envio">
      <ol className="grid grid-cols-5 gap-1">
        {shipmentProgress.map((step, index) => {
          const completed = !hasProblem && currentIndex >= index;
          return (
            <li key={step} className="flex flex-col items-center gap-1 text-center text-[10px]">
              <span
                className={`flex size-6 items-center justify-center rounded-full border text-xs ${completed ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"}`}
                aria-current={step === status ? "step" : undefined}
              >
                {completed ? "✓" : index + 1}
              </span>
              <span className="text-muted-foreground">{shipmentStatusLabels[step]}</span>
            </li>
          );
        })}
      </ol>
      {hasProblem ? (
        <p className="text-destructive mt-2 text-xs">Status atual: {shipmentStatusLabels[status] ?? status}</p>
      ) : null}
    </div>
  );
}
