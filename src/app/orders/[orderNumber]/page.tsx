import type { Metadata } from "next";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";

import { pageContainerClassName } from "@/components/ui/page-container";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { getCurrentSession } from "@/modules/auth/application/authorization";
import { CustomerAccountNavigation } from "@/modules/customers/components/customer-account-navigation";
import { resolveCustomerOrderIdentity } from "@/modules/orders/application/resolve-customer-order-access";
import { guestOrderPath, readGuestOrderCookie } from "@/modules/orders/infrastructure/guest-order-cookie";
import { ClaimGuestOrderForm } from "@/modules/orders/components/claim-guest-order-form";
import { OrderSummary } from "@/modules/orders/components/order-detail/order-summary";
import { PaymentSection } from "@/modules/orders/components/order-detail/payment-section";
import { SellerOrderSection } from "@/modules/orders/components/order-detail/seller-order-section";
import { getCustomerOrder } from "@/modules/returns/queries/customer-orders";
import { optionalTextSearchParam, parseSearchParams, type RawSearchParams } from "@/shared/validation/search-params";

export const metadata: Metadata = {
  title: "Acompanhar pedido",
  robots: { index: false, follow: false },
};

const orderSearchParams = { accessToken: optionalTextSearchParam(200) };

export default async function CustomerOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const [{ orderNumber }, rawSearchParams] = await Promise.all([params, searchParams]);
  const { accessToken: linkToken } = parseSearchParams(orderSearchParams, rawSearchParams);
  // Older links carry the token in the URL: swap it for the order cookie and drop it from the address.
  if (linkToken) {
    redirect(`${guestOrderPath(orderNumber)}/access?token=${encodeURIComponent(linkToken)}` as Route);
  }
  const accessToken = await readGuestOrderCookie();
  const session = await getCurrentSession();
  // Mesma regra das actions de pós-venda: token do link seguro primeiro, depois a sessão.
  const identity = await resolveCustomerOrderIdentity({ orderNumber, accessToken, userId: session?.user.id });
  // Signed out (e.g. after leaving in another tab): ask to sign in instead of saying the order does not exist.
  if (!identity && !session) redirect(`/login?next=${encodeURIComponent(guestOrderPath(orderNumber))}` as Route);
  if (!identity) notFound();

  const order = await getCustomerOrder(orderNumber, identity);
  if (!order) notFound();

  const pendingPayment = order.status === "PENDING_PAYMENT";
  const isOwner = Boolean(session && order.userId === session.user.id);
  const canClaim =
    session && accessToken && !order.userId && session.user.email.toLowerCase() === order.customerEmail.toLowerCase();

  return (
    <main className={pageContainerClassName("default", "py-10")}>
      <div className={session ? "grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]" : "grid grid-cols-1 gap-6"}>
        {session ? <CustomerAccountNavigation pathname={`/orders/${order.orderNumber}`} /> : null}
        <div className="flex min-w-0 flex-col gap-8">
          <PageHeader
            eyebrow="Pedido"
            title={order.orderNumber}
            description="Acompanhe pagamento, envios por loja e solicitações de pós-venda."
            {...(session ? { back: { href: "/orders", label: "Meus pedidos" } } : {})}
          />

          {canClaim ? <ClaimGuestOrderForm orderNumber={order.orderNumber} /> : null}

          <OrderSummary order={order} />

          {/* Paying is the next step of a pending order, so it comes before the deliveries. */}
          {pendingPayment ? <PaymentSection orderNumber={order.orderNumber} payments={order.payments} /> : null}

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
              />
            ))}
          </section>

          {pendingPayment ? null : <PaymentSection orderNumber={order.orderNumber} payments={order.payments} />}
        </div>
      </div>
    </main>
  );
}
