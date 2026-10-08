import { notFound } from "next/navigation";

import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { getCurrentSession } from "@/modules/auth/application/authorization";
import { CustomerAccountNavigation } from "@/modules/customers/components/customer-account-navigation";
import { resolveCustomerOrderIdentity } from "@/modules/orders/application/resolve-customer-order-access";
import { ClaimGuestOrderForm } from "@/modules/orders/components/claim-guest-order-form";
import { OrderSummary } from "@/modules/orders/components/order-detail/order-summary";
import { PaymentSection } from "@/modules/orders/components/order-detail/payment-section";
import { SellerOrderSection } from "@/modules/orders/components/order-detail/seller-order-section";
import { getCustomerOrder } from "@/modules/returns/queries/customer-orders";

export default async function CustomerOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ accessToken?: string }>;
}) {
  const [{ orderNumber }, { accessToken }] = await Promise.all([params, searchParams]);
  const session = await getCurrentSession();
  // Mesma regra das actions de pós-venda: token do link seguro primeiro, depois a sessão.
  const identity = await resolveCustomerOrderIdentity({ orderNumber, accessToken, userId: session?.user.id });
  if (!identity) notFound();

  const order = await getCustomerOrder(orderNumber, identity);
  if (!order) notFound();

  const isOwner = Boolean(session && order.userId === session.user.id);
  const tokenProps = accessToken ? { accessToken } : {};
  const canClaim =
    session && accessToken && !order.userId && session.user.email.toLowerCase() === order.customerEmail.toLowerCase();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className={session ? "grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]" : "grid grid-cols-1 gap-6"}>
        {session ? <CustomerAccountNavigation pathname={`/orders/${order.orderNumber}`} /> : null}
        <div className="flex min-w-0 flex-col gap-8">
          <PageHeader
            eyebrow="Pedido"
            title={order.orderNumber}
            description="Acompanhe pagamento, envios por loja e solicitações de pós-venda."
            {...(session ? { back: { href: "/orders", label: "Meus pedidos" } } : {})}
          />

          {canClaim && accessToken ? (
            <ClaimGuestOrderForm orderNumber={order.orderNumber} accessToken={accessToken} />
          ) : null}

          <OrderSummary order={order} />

          <section className="space-y-4">
            <SectionHeader
              title="Entregas por loja"
              description="Cada loja envia separadamente. Cancelamentos, devoluções e disputas são feitos por loja."
            />
            {order.sellerOrders.map((sellerOrder) => (
              <SellerOrderSection
                key={sellerOrder.id}
                orderNumber={order.orderNumber}
                sellerOrder={sellerOrder}
                canReview={isOwner}
                sellerAlreadyReviewed={order.sellerReviews.some((review) => review.sellerId === sellerOrder.sellerId)}
                {...tokenProps}
              />
            ))}
          </section>

          <PaymentSection orderNumber={order.orderNumber} payments={order.payments} {...tokenProps} />
        </div>
      </div>
    </main>
  );
}
