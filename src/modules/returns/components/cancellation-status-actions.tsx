"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormMessage } from "@/components/ui/form-message";
import { AfterSalesSummaryList, type AfterSalesSummary } from "@/shared/presentation/after-sales-summary";
import { callServerAction } from "@/shared/forms/server-action-submit";

import {
  reviewCancellationRequestAction,
  type CancellationAdminActionState,
} from "../actions/admin-cancellation-actions";

export function CancellationStatusActions({
  cancellationRequestId,
  status,
  summary,
}: {
  cancellationRequestId: string;
  status: string;
  summary: AfterSalesSummary;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<CancellationAdminActionState>({});

  async function submit(decision: "APPROVE" | "REJECT") {
    const formData = new FormData();
    formData.set("decision", decision);
    return callServerAction(() => reviewCancellationRequestAction(cancellationRequestId, formData));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {/* Dinheiro saindo: confirma com pedido, loja e valor antes de pedir o reembolso (BUG-002). */}
        <ConfirmDialog
          trigger={
            <Button size="sm" type="button" disabled={pending}>
              {status === "APPROVED" ? "Continuar processamento" : "Aprovar e reembolsar"}
            </Button>
          }
          title="Aprovar cancelamento e reembolsar?"
          description="O reembolso é pedido ao Mercado Pago e não pode ser desfeito por aqui."
          summary={<AfterSalesSummaryList summary={summary} />}
          confirmLabel="Aprovar e reembolsar"
          pendingLabel="Processando..."
          tone="destructive"
          onConfirm={async () => {
            const result = await submit("APPROVE");
            // O erro fica no próprio diálogo; o sucesso aparece no card depois que ele fecha.
            if (!result.error) setFeedback(result);
            return { error: result.error ?? null };
          }}
        />
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => startTransition(async () => setFeedback(await submit("REJECT")))}
          disabled={pending}
        >
          Recusar
        </Button>
      </div>
      <FormMessage error={feedback.error ?? null} success={feedback.success ?? null} className="text-xs" />
    </div>
  );
}
