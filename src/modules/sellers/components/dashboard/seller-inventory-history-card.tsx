import Link from "next/link";
import { History } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterDateRange, FilterForm, FilterSelect, FilterText } from "@/components/ui/filter-form";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listSellerInventoryMovements } from "@/modules/sellers/queries/inventory-movements";
import { loadInventorySearchParams } from "@/modules/sellers/inventory-search-params";
import { inventoryMovementLabels } from "@/shared/presentation/status-labels";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Histórico auditável de estoque; lê seus próprios filtros (`q`, `movementType`, `from`, `to`, `sort`). */
const movementTypeOptions = [
  { value: "ALL", label: "Todos" },
  ...Object.entries(inventoryMovementLabels).map(([value, label]) => ({ value, label })),
];
const sortOptions = [
  { value: "newest", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
];

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
        <div className="mb-4">
          <FilterForm resetHref="/seller#seller-history" action="/seller#seller-history" label="Filtrar movimentações">
            <FilterText label="Buscar produto ou SKU" name="q" value={params.q} placeholder="Nome, variação ou SKU" />
            <FilterSelect
              label="Tipo de movimentação"
              name="movementType"
              value={params.movementType}
              options={movementTypeOptions}
            />
            <FilterDateRange fromName="from" toName="to" from={params.from} to={params.to} />
            <FilterSelect label="Ordenação" name="sort" value={params.sort} options={sortOptions} />
          </FilterForm>
        </div>
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
