import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/modules/auth/application/authorization";
import { getActiveCart } from "@/modules/cart/queries/cart";
import { CheckoutForm } from "@/modules/checkout/components/checkout-form";
import { listCustomerAddresses } from "@/modules/customers/queries/customer-addresses";
import { getCurrentPriceInCents } from "@/modules/products/domain/pricing";

export default async function CheckoutPage() {
  const [cart, session] = await Promise.all([getActiveCart(), getCurrentSession()]);
  if (!cart || cart.items.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Seu carrinho está vazio</CardTitle>
          </CardHeader>
          <CardContent>
            <Link className="underline underline-offset-4" href="/products">
              Voltar para produtos
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const savedAddresses = session ? await listCustomerAddresses(session.user.id) : [];
  const now = new Date();
  const cartSummary = {
    itemCount: cart.items.reduce((total, item) => total + item.quantity, 0),
    itemsSubtotalInCents: cart.items.reduce(
      (total, item) => total + getCurrentPriceInCents(item.variant, now) * item.quantity,
      0,
    ),
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div>
        <p className="text-muted-foreground text-sm">Compra segura</p>
        <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
      </div>
      <CheckoutForm savedAddresses={savedAddresses} cartSummary={cartSummary} />
    </main>
  );
}
