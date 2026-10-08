import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime, formatMoneyInCents } from "@/lib/format";
import { PaymentRefreshForm } from "@/modules/payments/components/payment-refresh-form";
import { PixPaymentInstructions } from "@/modules/payments/components/pix-payment-instructions";
import { getPixInstructions } from "@/modules/payments/domain/pix-instructions";

import type { CustomerOrderPayment } from "./types";

// Tipos de transação não são status de domínio: rótulos de apresentação local.
const transactionTypeLabels: Record<string, string> = {
  AUTHORIZATION: "Autorização",
  CAPTURE: "Captura",
  REFUND: "Reembolso",
  VOID: "Estorno",
};
const transactionOutcomeLabels: Record<string, string> = {
  PENDING: "pendente",
  SUCCEEDED: "concluída",
  FAILED: "falhou",
};

// Identificadores de meio de pagamento do Mercado Pago (`payment_method_id`).
const paymentMethodLabels: Record<string, string> = {
  pix: "Pix",
  visa: "Cartão Visa",
  master: "Cartão Mastercard",
  amex: "Cartão American Express",
  elo: "Cartão Elo",
  hipercard: "Cartão Hipercard",
};

export function PaymentSection({
  orderNumber,
  payments,
  accessToken,
}: {
  orderNumber: string;
  payments: CustomerOrderPayment[];
  accessToken?: string;
}) {
  return (
    <section className="space-y-4">
      <SectionHeader title="Pagamento" description="Status e histórico de transações do pedido." />
      <Card>
        <CardContent className="flex flex-col gap-4">
          {payments.length === 0 ? (
            <EmptyState variant="inline" title="Nenhum pagamento registrado" />
          ) : (
            payments.map((payment) => {
              const pixInstructions = getPixInstructions(payment);
              return (
                <div key={payment.id} className="border-border rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-foreground font-medium">
                        {(payment.method && paymentMethodLabels[payment.method]) ?? payment.method ?? payment.provider}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {formatMoneyInCents(payment.amountInCents)} · {formatDateTime(payment.createdAt)}
                      </p>
                    </div>
                    <StatusBadge domain="payment" status={payment.status} />
                  </div>
                  {pixInstructions ? <PixPaymentInstructions {...pixInstructions} /> : null}
                  {payment.method === "pix" &&
                  ["PENDING", "PROCESSING"].includes(payment.status) &&
                  !pixInstructions ? (
                    <p className="text-muted-foreground mt-3 text-sm">
                      O código Pix ainda não está disponível. Consulte o status em instantes.
                    </p>
                  ) : null}
                  {payment.transactions.length > 0 ? (
                    <ul className="text-muted-foreground mt-3 space-y-1 text-xs">
                      {payment.transactions.map((transaction) => (
                        <li key={transaction.id}>
                          {transactionTypeLabels[transaction.type] ?? transaction.type}{" "}
                          {transactionOutcomeLabels[transaction.status] ?? transaction.status} ·{" "}
                          {formatDateTime(transaction.createdAt)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {["PENDING", "PROCESSING", "AUTHORIZED"].includes(payment.status) ? (
                    <div className="mt-3">
                      <PaymentRefreshForm orderNumber={orderNumber} {...(accessToken ? { accessToken } : {})} />
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </section>
  );
}
