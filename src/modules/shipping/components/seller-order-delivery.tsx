import { InlineNotice } from "@/components/ui/inline-notice";
import { formatDate } from "@/lib/format";
import { formatCep } from "@/modules/customers/domain/brazilian-address";
import { formatPhone } from "@/modules/customers/domain/tax-id";

import { canPrepareSellerOrder, canShowSellerOrderDeliveryData } from "../domain/seller-order-queue";
import type { listSellerOrders } from "../queries/seller-orders";

type SellerOrderListItem = Awaited<ReturnType<typeof listSellerOrders>>["orders"][number];

/** Itens e endereço da entrega própria; antes do pagamento, só o aviso para não preparar. */
export function SellerOrderDelivery({ order }: { order: SellerOrderListItem }) {
  if (order.status === "PENDING_PAYMENT") {
    return (
      <InlineNotice tone="warning">
        Aguardando pagamento: não prepare ainda. Endereço e telefone aparecem quando o pagamento for confirmado.
      </InlineNotice>
    );
  }

  const cancellation = order.cancellationRequests[0];
  if (order.status === "CANCELLATION_REQUESTED" && cancellation) {
    // Só o motivo, sem ações: a decisão do cancelamento é do Moto Shop (UX-13).
    return (
      <InlineNotice tone="warning">
        <strong>Cancelamento pedido pelo cliente</strong> em {formatDate(cancellation.createdAt)} · Motivo:{" "}
        {cancellation.customerMessage ? `"${cancellation.customerMessage}"` : "não informado"}. O Moto Shop está
        analisando; não despache este pedido.
      </InlineNotice>
    );
  }

  const address = order.order.shippingAddress;
  if (order.shipment?.provider !== "OWN" || !address || !canShowSellerOrderDeliveryData(order.status)) return null;

  return (
    <section className="bg-muted grid gap-2 rounded-md p-3 text-sm" aria-label="Dados da entrega própria">
      <h4 className="font-semibold">{canPrepareSellerOrder(order.status) ? "Preparar entrega" : "Dados da entrega"}</h4>
      <ul className="list-inside list-disc">
        {order.items.map((item) => (
          <li key={item.id}>
            {item.quantity} × {item.productNameSnapshot} · {item.variantDescriptionSnapshot} · SKU {item.skuSnapshot}
          </li>
        ))}
      </ul>
      <address className="break-words not-italic">
        {address.recipient}
        <br />
        {address.street}, {address.number}
        {address.complement ? ` · ${address.complement}` : ""}
        <br />
        {address.neighborhood} · {address.city}/{address.state}
        <br />
        CEP {formatCep(address.postalCode)} · Telefone {formatPhone(order.order.customerPhone)}
      </address>
    </section>
  );
}
