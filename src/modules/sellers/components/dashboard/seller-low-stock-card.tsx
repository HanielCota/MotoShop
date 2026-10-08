import Link from "next/link";
import { PackageCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { listSellerLowStockVariants } from "@/modules/sellers/queries/seller-dashboard";

type LowStockProduct = { id: string; name: string; slug: string; status: string };

function ProductName({ product }: { product: LowStockProduct }) {
  if (product.status === "DRAFT" || product.status === "REJECTED") {
    return (
      <Link href={`/seller/products/${product.id}/edit`} className="font-medium hover:underline">
        {product.name}
      </Link>
    );
  }
  if (product.status === "APPROVED") {
    return (
      <Link href={`/products/${product.slug}`} className="font-medium hover:underline">
        {product.name}
      </Link>
    );
  }
  return <span className="font-medium">{product.name}</span>;
}

export async function SellerLowStockCard({ sellerId }: { sellerId: string }) {
  const variants = await listSellerLowStockVariants(sellerId);

  return (
    <Card id="seller-stock" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg">Estoque baixo</h2>
        </CardTitle>
        <CardDescription>Variações com até 5 unidades disponíveis.</CardDescription>
      </CardHeader>
      <CardContent>
        {variants.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={PackageCheck}
            title="Estoque em dia"
            description="Nenhuma variação precisa de reposição agora."
          />
        ) : (
          <ul className="divide-border divide-y">
            {variants.map((inventory) => (
              <li key={inventory.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ProductName product={inventory.variant.product} />
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
      </CardContent>
    </Card>
  );
}
