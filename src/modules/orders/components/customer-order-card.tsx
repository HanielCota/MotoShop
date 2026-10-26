import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatMoneyInCents } from "@/lib/format";
import { CartItemThumbnail } from "@/modules/cart/components/cart-item-thumbnail";

import { customerOrderHeadline } from "../domain/customer-order-headline";
import type { listCustomerOrders } from "../queries/customer-orders";

type CustomerOrder = Awaited<ReturnType<typeof listCustomerOrders>>["orders"][number];

/** The item the card shows: the first one bought, which is also the one whose photo the list looks up. */
export function firstOrderItem(order: CustomerOrder) {
  return order.sellerOrders.flatMap((sellerOrder) => sellerOrder.items)[0];
}

function firstItem(order: CustomerOrder) {
  const items = order.sellerOrders.flatMap((sellerOrder) => sellerOrder.items);
  return {
    name: items[0]?.productNameSnapshot ?? "Pedido",
    otherItems: Math.max(items.length - 1, 0),
  };
}

/**
 * One order in the customer's list: a single status in plain words, the first product to recognize
 * the purchase, and the whole card as the link to the order.
 */
export function CustomerOrderCard({
  order,
  thumbnailUrl,
}: {
  order: CustomerOrder;
  /** Photo of the first item, with the cart's rule (variant photo first); without it, the placeholder. */
  thumbnailUrl: string | undefined;
}) {
  const href = `/orders/${order.orderNumber}` as Route;
  const item = firstItem(order);
  const stores = order.sellerOrders.map((sellerOrder) => sellerOrder.storeNameSnapshot).join(", ");
  const pendingPayment = order.status === "PENDING_PAYMENT";
  const trackedShipments = order.sellerOrders.filter((sellerOrder) => sellerOrder.shipment?.trackingUrl);

  return (
    <Card className="hover:border-foreground/30 relative transition-colors">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>
              {/* The stretched link makes the whole card clickable; other links sit above it. */}
              <Link className="after:absolute after:inset-0 hover:underline" href={href}>
                {order.orderNumber}
              </Link>
            </CardTitle>
            <CardDescription>{formatDate(order.createdAt)}</CardDescription>
          </div>
          <StatusBadge domain="order" status={order.status} label={customerOrderHeadline(order.status)} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <CartItemThumbnail url={thumbnailUrl} sizes="56px" className="size-14" />
          <span className="min-w-0 flex-1">
            <span className="text-foreground line-clamp-2 block text-sm font-medium">{item.name}</span>
            <span className="text-muted-foreground block truncate text-xs">
              {stores}
              {item.otherItems > 0 ? ` · +${item.otherItems} ${item.otherItems === 1 ? "item" : "itens"}` : ""}
            </span>
          </span>
          <strong className="text-foreground shrink-0 text-sm tabular-nums">
            {formatMoneyInCents(order.totalAmountInCents)}
          </strong>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-brand-strong inline-flex items-center gap-1 font-semibold">
            {pendingPayment ? "Ver pedido e pagar" : "Ver pedido"}
            <ArrowRight aria-hidden="true" className="size-4" />
          </span>
          {trackedShipments.map((sellerOrder) => (
            <a
              key={sellerOrder.id}
              className="text-brand-strong relative z-10 inline-flex min-h-11 items-center text-xs underline"
              href={sellerOrder.shipment?.trackingUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
            >
              Acompanhar entrega{trackedShipments.length > 1 ? ` · ${sellerOrder.storeNameSnapshot}` : ""}
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
