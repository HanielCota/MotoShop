import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { InlineNotice } from "@/components/ui/inline-notice";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentSession } from "@/modules/auth/application/authorization";
import { getActiveCart } from "@/modules/cart/queries/cart";
import { VisualCheckoutPreview } from "@/modules/cart/components/visual-preview";
import { CheckoutForm } from "@/modules/checkout/components/checkout-form";
import { getCustomerContact } from "@/modules/customers/queries/customer-contact";
import { listCustomerAddresses } from "@/modules/customers/queries/customer-addresses";
import { getCheckoutPaymentAvailability } from "@/modules/payments/application/assert-payment-ready";
import { getCurrentPriceInCents } from "@/modules/products/domain/pricing";

export const metadata: Metadata = {
  title: "Finalizar compra",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string | string[] }>;
}) {
  const { preview } = await searchParams;
  if (process.env.NODE_ENV !== "production" && preview === "1") return <VisualCheckoutPreview />;

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
        {process.env.NODE_ENV !== "production" ? (
          <p className="text-center">
            <Link href="/checkout?preview=1" className="text-sm underline underline-offset-4">
              Ver prévia com produtos de exemplo
            </Link>
          </p>
        ) : null}
      </main>
    );
  }

  const [savedAddresses, customerContact] = session
    ? await Promise.all([listCustomerAddresses(session.user.id), getCustomerContact(session.user.id)])
    : [[], undefined];
  const customerDefaults = session && customerContact ? { ...customerContact, email: session.user.email } : undefined;
  const now = new Date();
  const items = cart.items.map((item) => ({
    id: item.id,
    name: item.variant.product.name,
    variant: item.variant.title,
    quantity: item.quantity,
    lineTotalInCents: getCurrentPriceInCents(item.variant, now) * item.quantity,
  }));
  const payment = getCheckoutPaymentAvailability(new Set(cart.items.map((item) => item.variant.product.sellerId)).size);
  const cartSummary = {
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    itemsSubtotalInCents: items.reduce((total, item) => total + item.lineTotalInCents, 0),
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Compra segura"
        title="Finalizar compra"
        back={{ href: "/cart", label: "Voltar ao carrinho" }}
      />
      {payment.available ? null : (
        <InlineNotice tone="warning">
          O pagamento pelo marketplace ainda não está disponível para este carrinho. Você pode conferir frete e entrega,
          mas nenhum pedido ou cobrança será criado agora.
        </InlineNotice>
      )}
      <CheckoutForm
        savedAddresses={savedAddresses}
        customerDefaults={customerDefaults}
        cartSummary={cartSummary}
        items={items}
        paymentAvailable={payment.available}
        cardPublicKey={payment.cardPublicKey}
      />
    </main>
  );
}
