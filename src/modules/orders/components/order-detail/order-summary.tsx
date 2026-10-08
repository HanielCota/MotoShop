import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime, formatMoneyInCents } from "@/lib/format";

import type { CustomerOrderDetail } from "./types";

export function OrderSummary({ order }: { order: CustomerOrderDetail }) {
  const latestPayment = order.payments[0];
  const shippingInCents = order.sellerOrders.reduce(
    (total, sellerOrder) => total + sellerOrder.customerShippingAmountInCents,
    0,
  );

  return (
    <Card>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
          <div className="space-y-1">
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <StatusBadge domain="order" status={order.status} />
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">Total</dt>
            <dd className="text-foreground text-lg font-semibold">{formatMoneyInCents(order.totalAmountInCents)}</dd>
            <dd className="text-muted-foreground text-xs">Frete {formatMoneyInCents(shippingInCents)}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">Data do pedido</dt>
            <dd className="text-foreground font-medium">{formatDateTime(order.createdAt)}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">Pagamento</dt>
            <dd>
              {latestPayment ? (
                <StatusBadge domain="payment" status={latestPayment.status} />
              ) : (
                <span className="text-muted-foreground">Não iniciado</span>
              )}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
