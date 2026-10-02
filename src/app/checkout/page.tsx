import Link from "next/link";
import { ShoppingBag } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
        <Card className="border-[#e1dcd3] bg-white">
          <CardContent className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
            <span className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-[#fff0e8] text-[#c54817]">
              <ShoppingBag className="size-8" aria-hidden="true" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">Seu carrinho está vazio</h1>
            <p className="text-muted-foreground mt-2 max-w-md text-sm leading-6">
              Adicione um produto ao carrinho para continuar a compra.
            </p>
            <Link className={buttonVariants({ className: "mt-6 rounded-lg px-5" })} href="/products">
              Explorar produtos
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
      <CheckoutForm
        savedAddresses={savedAddresses}
        cartSummary={cartSummary}
        paymentAvailable={false}
      />
    </main>
  );
}
