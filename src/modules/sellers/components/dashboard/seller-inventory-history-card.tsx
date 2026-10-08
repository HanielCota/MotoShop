import Link from "next/link";
import { History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateFilterInput } from "@/components/ui/date-filter-input";
import { DesignSelect } from "@/components/ui/design-select";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listSellerInventoryMovements } from "@/modules/sellers/queries/inventory-movements";
import { loadInventorySearchParams } from "@/modules/sellers/inventory-search-params";
import { inventoryMovementLabels } from "@/shared/presentation/status-labels";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Histórico auditável de estoque; lê seus próprios filtros (`q`, `movementType`, `from`, `to`, `sort`). */
export async function SellerInventoryHistoryCard({
  sellerId,
  searchParams,
}: {
  sellerId: string;
  searchParams: SearchParams;
}) {
  const params = await loadInventorySearchParams(searchParams);
  const movements = await listSellerInventoryMovements(sellerId, {
    q: params.q,
    type: params.movementType,
    from: params.from,
    to: params.to,
    sort: params.sort,
  });
  const hasFilters = Boolean(params.q || params.from || params.to || params.movementType !== "ALL");

  return (
    <Card id="seller-history" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg">Histórico de estoque</h2>
        </CardTitle>
        <CardDescription>Últimas movimentações auditáveis das variações da loja.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="mb-4 grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto_auto_auto] lg:items-end"
          method="get"
          action="/seller#seller-history"
        >
          <label className="flex flex-col gap-1 text-sm font-medium">
            Buscar produto ou SKU
            <Input name="q" defaultValue={params.q ?? ""} placeholder="Nome, variação ou SKU" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Tipo de movimentação
            <DesignSelect aria-label="Tipo de movimentação" name="movementType" defaultValue={params.movementType}>
              <option value="ALL">Todos</option>
              {Object.entries(inventoryMovementLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </DesignSelect>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            De
            <DateFilterInput name="from" value={params.from} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Até
            <DateFilterInput name="to" value={params.to} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Ordenação
            <DesignSelect aria-label="Ordenação" name="sort" defaultValue={params.sort}>
              <option value="newest">Mais recentes</option>
              <option value="oldest">Mais antigos</option>
            </DesignSelect>
          </label>
          <Button type="submit">Filtrar</Button>
        </form>
        {movements.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={History}
            title={hasFilters ? "Nenhuma movimentação encontrada" : "Ainda não há movimentações de estoque"}
            description={
              hasFilters
                ? "Ajuste ou limpe os filtros para ver outras movimentações."
                : "Vendas, reservas e ajustes manuais aparecerão aqui."
            }
            action={hasFilters ? { label: "Limpar filtros", href: "/seller#seller-history" } : undefined}
          />
        ) : (
          <ul className="divide-border divide-y">
            {movements.map((movement) => (
              <li
                key={movement.id}
                className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <Link
                    href={`/seller/products/${movement.variant.product.id}/edit`}
                    className="font-medium hover:underline"
                  >
                    {movement.variant.product.name}
                  </Link>
                  <p className="text-muted-foreground text-xs">
                    {movement.variant.title} · SKU {movement.variant.sku} ·{" "}
                    {inventoryMovementLabels[movement.type] ?? movement.type}
                  </p>
                </div>
                <div className="text-xs tabular-nums sm:text-right">
                  <p
                    className={cn(
                      "font-medium",
                      movement.quantityChange < 0 ? "text-destructive" : "text-success-foreground",
                    )}
                  >
                    {movement.quantityChange > 0 ? "+" : ""}
                    {movement.quantityChange} · saldo {movement.availableQuantityAfter}
                  </p>
                  <p className="text-muted-foreground">
                    <time dateTime={movement.createdAt.toISOString()}>{formatDateTime(movement.createdAt)}</time>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
