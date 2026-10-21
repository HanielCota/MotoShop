import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";

import { pageContainerClassName } from "@/components/ui/page-container";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentSession } from "@/modules/auth/application/authorization";
import { getActiveCart } from "@/modules/cart/queries/cart";
import { CheckoutForm } from "@/modules/checkout/components/checkout-form";
import { getCustomerContact } from "@/modules/customers/queries/customer-contact";
import { listCustomerAddresses } from "@/modules/customers/queries/customer-addresses";
import { getCheckoutPaymentAvailability } from "@/modules/payments/application/assert-payment-ready";
import { getCurrentPriceInCents } from "@/modules/products/domain/pricing";

export const metadata: Metadata = {
  title: "Finalizar compra",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const [cart, session] = await Promise.all([getActiveCart(), getCurrentSession()]);
  if (!cart || cart.items.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
        <PageHeader eyebrow="Compra segura" title="Finalizar compra" />
        <EmptyState
          icon={ShoppingBag}
          title="Seu carrinho está vazio"
          description="Adicione um produto ao carrinho para continuar a compra."
          action={{ label: "Ver produtos", href: "/products" }}
        />
      </main>
    );
  }

  const [savedAddresses, customerContact] = session
    ? await Promise.all([listCustomerAddresses(session.user.id), getCustomerContact(session.user.id)])
    : [[], undefined];
  const customerDefaults = session && customerContact ? { ...customerContact, email: session.user.email } : undefined;
  // oxlint-disable-next-line react/purity -- Server Component: it renders once per request, on the server, so the date cannot drift between renders.
  const now = new Date();
  const items = cart.items.map((item) => ({
    id: item.id,
    name: item.variant.product.name,
    variant: item.variant.title,
    quantity: item.quantity,
    lineTotalInCents: getCurrentPriceInCents(item.variant, now) * item.quantity,
  }));
  const payment = getCheckoutPaymentAvailability(new Set(cart.items.map((item) => item.variant.product.sellerId)).size);
  // Test products end in the simulated purchase: Pix only, nothing recorded.
  const testOnlyCart = cart.items.every((item) => item.variant.product.isDemo);
  const cartSummary = {
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    itemsSubtotalInCents: items.reduce((total, item) => total + item.lineTotalInCents, 0),
  };

  return (
    <main className={pageContainerClassName("default", "flex flex-col gap-6 py-10")}>
      <CheckoutForm
        header={
          <PageHeader
            eyebrow="Compra segura"
            title="Finalizar compra"
            back={{ href: "/cart", label: "Voltar ao carrinho" }}
          />
        }
        savedAddresses={savedAddresses}
        customerDefaults={customerDefaults}
        cartSummary={cartSummary}
        items={items}
        paymentAvailable={payment.available || testOnlyCart}
        pixOnly={testOnlyCart}
        cardPublicKey={payment.cardPublicKey}
      />
    </main>
  );
}
