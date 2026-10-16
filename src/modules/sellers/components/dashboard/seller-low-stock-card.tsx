import Link from "next/link";
import type { Route } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { listSellerLowStockVariants } from "@/modules/sellers/queries/seller-dashboard";
import { countSellerStockAlerts } from "@/modules/sellers/queries/seller-overview-metrics";
import { domainIcons } from "@/shared/presentation/domain-icons";

export async function SellerLowStockCard({ sellerId }: { sellerId: string }) {
  const [variants, alerts] = await Promise.all([
    listSellerLowStockVariants(sellerId),
    countSellerStockAlerts(sellerId),
  ]);

  return (
    <Card id="seller-stock" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Estoque baixo</CardTitle>
        <CardDescription>Variações com até 5 unidades disponíveis.</CardDescription>
      </CardHeader>
      <CardContent>
        {variants.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={domainIcons.stock}
            title="Estoque em dia"
            description="Nenhuma variação precisa de reposição agora."
          />
        ) : (
          <ul className="divide-border divide-y">
            {variants.map((inventory) => (
              <li key={inventory.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Abre o produto na lista da Central, onde o estoque é ajustado (UX-09). */}
                    <Link
                      href={`/seller/products?productQ=${encodeURIComponent(inventory.variant.sku)}` as Route}
                      className="font-medium hover:underline"
                    >
                      {inventory.variant.product.name}
                    </Link>
                    <StatusBadge domain="product" status={inventory.variant.product.status} />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {inventory.variant.title} · SKU {inventory.variant.sku}
                  </p>
                </div>
                <Badge
                  variant={inventory.availableQuantity === 0 ? "destructive" : "warning"}
                  className="shrink-0 tabular-nums"
                >
                  {inventory.availableQuantity === 0 ? "Esgotado" : `${inventory.availableQuantity} un.`}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        {alerts.low + alerts.out > variants.length ? (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
            {alerts.low > 0 ? (
              <Link
                href="/seller/products?productStock=LOW"
                className="text-brand-strong inline-flex min-h-11 items-center underline-offset-4 hover:underline"
              >
                Ver estoque baixo ({alerts.low})
              </Link>
            ) : null}
            {alerts.out > 0 ? (
              <Link
                href="/seller/products?productStock=OUT"
                className="text-brand-strong inline-flex min-h-11 items-center underline-offset-4 hover:underline"
              >
                Ver esgotados ({alerts.out})
              </Link>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
