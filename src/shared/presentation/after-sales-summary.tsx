import { formatMoneyInCents } from "@/lib/format";

/** Pedido, loja e valor mostrados na confirmação de ações de pós-venda com dinheiro (BUG-002). */
export type AfterSalesSummary = { orderNumber: string; storeName: string; amountInCents?: number | undefined };

export function AfterSalesSummaryList({ summary, amountLabel }: { summary: AfterSalesSummary; amountLabel?: string }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      <dt className="text-muted-foreground">Pedido</dt>
      <dd>{summary.orderNumber}</dd>
      <dt className="text-muted-foreground">Loja</dt>
      <dd>{summary.storeName}</dd>
      {summary.amountInCents !== undefined ? (
        <>
          <dt className="text-muted-foreground">{amountLabel ?? "Valor do reembolso"}</dt>
          <dd className="font-semibold tabular-nums">{formatMoneyInCents(summary.amountInCents)}</dd>
        </>
      ) : null}
    </dl>
  );
}
