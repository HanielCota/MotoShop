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

export const INVENTORY_HISTORY_PATH = "/seller/products/inventory-history";

const movementTypeOptions = [
  { value: "ALL", label: "Todos" },
  ...Object.entries(inventoryMovementLabels).map(([value, label]) => ({ value, label })),
];
const SUMMARY_LIMIT = 5;
const sortOptions = [
  { value: "newest", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
];

/**
 * Histórico auditável de estoque; lê seus próprios filtros (`q`, `movementType`, `from`, `to`, `sort`).
 * No resumo da visão geral, mostra só as últimas movimentações e o link para a página completa.
 */
export async function SellerInventoryHistoryCard({
  sellerId,
  searchParams,
  summary = false,
}: {
  sellerId: string;
  searchParams: SearchParams;
  summary?: boolean;
}) {
  const params = summary ? null : await loadInventorySearchParams(searchParams);
  const filters = params
    ? { q: params.q, type: params.movementType, from: params.from, to: params.to, sort: params.sort }
    : {};
  const movements = await listSellerInventoryMovements(sellerId, {
    ...filters,
    limit: summary ? SUMMARY_LIMIT : 50,
  });
  const hasFilters = Boolean(params && (params.q || params.from || params.to || params.movementType !== "ALL"));

  return (
    <Card id="seller-history" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg">Histórico de estoque</h2>
        </CardTitle>
        <CardDescription>
          {summary
            ? `${SUMMARY_LIMIT} movimentações mais recentes das variações da loja.`
            : "Movimentações auditáveis das variações da loja (até 50 por consulta)."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {params ? (
          <div className="mb-4">
            <FilterForm
              resetHref={INVENTORY_HISTORY_PATH}
              action={INVENTORY_HISTORY_PATH}
              label="Filtrar movimentações"
            >
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
        ) : null}
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
            action={hasFilters ? { label: "Limpar filtros", href: INVENTORY_HISTORY_PATH } : undefined}
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
        {summary ? (
          <Link
            href={INVENTORY_HISTORY_PATH}
            className="text-brand-strong mt-2 inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline"
          >
            Ver histórico completo
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
