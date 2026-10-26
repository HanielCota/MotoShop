import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { adminHref } from "@/modules/admin/admin-href";
import { AdminSellerOrderCard } from "@/modules/admin/components/order-detail/admin-seller-order-card";
import { getAdminOrderDetail } from "@/modules/admin/queries/order-detail";
import { getOrderItemThumbnails } from "@/modules/orders/queries/order-item-thumbnails";
import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { formatCep } from "@/modules/customers/domain/brazilian-address";
import { formatPhone } from "@/modules/customers/domain/tax-id";
import { OrderSummary } from "@/modules/orders/components/order-detail/order-summary";
import { PaymentSection } from "@/modules/orders/components/order-detail/payment-section";

export const metadata: Metadata = {
  title: "Pedido · Admin",
  robots: { index: false, follow: false },
};

/** Detalhe do pedido para mediação (UX-04); só existe em /admin/orders/<número>. */
export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ section: string; orderNumber: string }>;
}) {
  await requireAdminAccess();
  const { section, orderNumber } = await params;
  if (section !== "orders") notFound();

  const order = await getAdminOrderDetail(decodeURIComponent(orderNumber));
  if (!order) notFound();

  const address = order.shippingAddress;
  const thumbnails = await getOrderItemThumbnails(order.sellerOrders.flatMap((sellerOrder) => sellerOrder.items));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pedido"
        title={order.orderNumber}
        description="Pagamento, envios e solicitações de pós-venda de cada loja."
        back={{ href: adminHref("orders", {}), label: "Pedidos" }}
      />

      <OrderSummary order={order} />

      <Card>
        <CardContent className="space-y-1 text-sm">
          <h2 className="text-foreground font-semibold">Cliente</h2>
          <p className="break-words">
            {order.customerName} · {order.customerEmail} · {formatPhone(order.customerPhone)}
          </p>
          {address ? (
            <p className="text-muted-foreground break-words">
              Entrega: {address.street}, {address.number}
              {address.complement ? ` · ${address.complement}` : ""} · {address.neighborhood} · {address.city}/
              {address.state} · CEP {formatCep(address.postalCode)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <section className="space-y-4">
        <SectionHeader title="Lojas" description="Cada loja tem envio, cancelamento, devolução e disputa próprios." />
        {order.sellerOrders.map((sellerOrder) => (
          <AdminSellerOrderCard
            key={sellerOrder.id}
            orderNumber={order.orderNumber}
            sellerOrder={sellerOrder}
            thumbnails={thumbnails}
          />
        ))}
      </section>

      <PaymentSection orderNumber={order.orderNumber} payments={order.payments} readOnly />
    </div>
  );
}
