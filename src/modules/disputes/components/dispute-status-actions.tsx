"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormMessage } from "@/components/ui/form-message";
import { AfterSalesSummaryList, type AfterSalesSummary } from "@/shared/presentation/after-sales-summary";
import { callServerAction } from "@/shared/forms/server-action-submit";

import { reviewDisputeAction } from "../actions/admin-dispute-actions";

type Feedback = { error?: string; success?: string };
type Decision = "START_REVIEW" | "RESOLVE" | "REJECT";

export function DisputeStatusActions({
  disputeId,
  status,
  summary,
}: {
  disputeId: string;
  status: string;
  summary: AfterSalesSummary;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>({});

  function submit(decision: Decision, note?: string) {
    const formData = new FormData();
    formData.set("decision", decision);
    if (note) formData.set("note", note);
    return callServerAction(() => reviewDisputeAction(disputeId, formData));
  }

  async function confirmDecision(decision: Decision, note: string) {
    const result = await submit(decision, note);
    if (!result.error) setFeedback(result);
    return { error: result.error ?? null };
  }

  return (
    <div className="flex min-w-56 flex-col gap-2">
      {status === "OPEN" ? (
        <Button
          type="button"
          size="sm"
          onClick={() => startTransition(async () => setFeedback(await submit("START_REVIEW")))}
          disabled={pending}
        >
          Assumir análise
        </Button>
      ) : null}
      {status === "UNDER_REVIEW" ? (
        // Encerrar a disputa pede confirmação com o pedido e uma justificativa obrigatória (BUG-002).
        <div className="flex flex-wrap gap-2">
          <ConfirmDialog
            trigger={
              <Button type="button" size="sm">
                Resolver
              </Button>
            }
            title="Resolver a disputa?"
            description="A disputa é encerrada como resolvida. A resolução fica registrada na auditoria."
            summary={<AfterSalesSummaryList summary={summary} />}
            reason={{ label: "Resolução", required: true, maxLength: 2000 }}
            confirmLabel="Resolver"
            pendingLabel="Salvando..."
            onConfirm={({ reason }) => confirmDecision("RESOLVE", reason)}
          />
          <ConfirmDialog
            trigger={
              <Button type="button" size="sm" variant="outline">
                Recusar
              </Button>
            }
            title="Recusar a disputa?"
            description="A disputa é encerrada sem acolher o pedido do cliente."
            summary={<AfterSalesSummaryList summary={summary} />}
            reason={{ label: "Motivo da recusa", required: true, maxLength: 2000 }}
            confirmLabel="Recusar disputa"
            pendingLabel="Salvando..."
            tone="destructive"
            onConfirm={({ reason }) => confirmDecision("REJECT", reason)}
          />
        </div>
      ) : null}
      <FormMessage error={feedback.error ?? null} success={feedback.success ?? null} className="text-xs" />
    </div>
  );
}
