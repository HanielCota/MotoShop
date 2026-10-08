import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyInCents } from "@/lib/format";
import { getSellerFinancialSummary } from "@/modules/sellers/queries/seller-dashboard";

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
      {hint ? <dd className="text-muted-foreground text-xs">{hint}</dd> : null}
    </div>
  );
}

export async function SellerFinanceCard({ sellerId }: { sellerId: string }) {
  const summary: Awaited<ReturnType<typeof getSellerFinancialSummary>> & { refundedAmountInCents?: number } =
    await getSellerFinancialSummary(sellerId);
  const refundedAmountInCents = summary.refundedAmountInCents ?? 0;

  return (
    <Card id="seller-finance" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg">Resumo financeiro</h2>
        </CardTitle>
        <CardDescription>Vendas confirmadas e valores registrados por pedido.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <Metric
            label="Vendas"
            value={formatMoneyInCents(summary.grossSalesInCents)}
            hint={`${summary.orderCount} ${summary.orderCount === 1 ? "pedido" : "pedidos"}`}
          />
          <Metric label="Comissão do Moto Shop" value={formatMoneyInCents(summary.commissionInCents)} />
          <Metric label="Líquido da loja" value={formatMoneyInCents(summary.sellerNetAmountInCents)} />
          {refundedAmountInCents > 0 ? (
            <Metric label="Reembolsado" value={formatMoneyInCents(refundedAmountInCents)} />
          ) : null}
        </dl>
      </CardContent>
    </Card>
  );
}
