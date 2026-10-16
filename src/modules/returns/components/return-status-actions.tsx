"use client";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { AfterSalesSummaryList, type AfterSalesSummary } from "@/shared/presentation/after-sales-summary";

import { useState, useTransition } from "react";

import { refundReturnRequestAction, reviewReturnRequestAction } from "../actions/admin-return-actions";
import { useClientValidation } from "@/shared/forms/client-validation";
import { requiredTextValidator } from "@/shared/forms/required-text";
import { callServerAction } from "@/shared/forms/server-action-submit";

const validateRejection = requiredTextValidator("note", "Informe o motivo para recusar a devolução.");

type Feedback = { error?: string; success?: string };

export function ReturnStatusActions({
  returnRequestId,
  status,
  summary,
}: {
  returnRequestId: string;
  status: string;
  summary: AfterSalesSummary;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>({});
  const { clientError, onSubmit } = useClientValidation(validateRejection);
  const canReview = status === "REQUESTED" || status === "UNDER_REVIEW";
  const canReceive = status === "APPROVED";
  const canRefund = status === "RETURNED";

  function review(decision: "APPROVE" | "RECEIVE", note?: string) {
    const formData = new FormData();
    formData.set("decision", decision);
    if (note) formData.set("note", note);
    startTransition(async () => {
      const result = await callServerAction(() => reviewReturnRequestAction(returnRequestId, formData));
      setFeedback(result);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {canReview ? (
        <div className="flex flex-wrap gap-2">
          <Button pending={pending} pendingLabel="Salvando…" size="sm" type="button" onClick={() => review("APPROVE")}>
            Aprovar
          </Button>
          <form
            action={async (formData) => {
              const result = await callServerAction(() => reviewReturnRequestAction(returnRequestId, formData));
              setFeedback(result);
            }}
            onSubmit={onSubmit}
            noValidate
            className="flex min-w-0 flex-1 items-end gap-2"
          >
            <input type="hidden" name="decision" value="REJECT" />
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium">
              Motivo da recusa
              <Input
                name="note"
                placeholder="Explique ao cliente por que recusou"
                aria-invalid={clientError ? true : undefined}
                className="min-w-0"
              />
            </label>
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              Recusar
            </Button>
          </form>
        </div>
      ) : null}
      {canReceive ? (
        <Button
          pending={pending}
          pendingLabel="Registrando…"
          variant="outline"
          size="sm"
          type="button"
          onClick={() => review("RECEIVE")}
        >
          Registrar recebimento
        </Button>
      ) : null}
      {canRefund ? (
        // Dinheiro saindo: confirma com pedido, loja e valor antes do reembolso (BUG-002).
        <ConfirmDialog
          trigger={
            <Button size="sm" type="button" disabled={pending}>
              Processar reembolso
            </Button>
          }
          title="Reembolsar esta devolução?"
          description="O reembolso é pedido ao Mercado Pago e não pode ser desfeito por aqui."
          summary={<AfterSalesSummaryList summary={summary} />}
          confirmLabel="Reembolsar"
          pendingLabel="Reembolsando…"
          tone="destructive"
          onConfirm={async () => {
            const result = await callServerAction(() => refundReturnRequestAction(returnRequestId));
            if (!result.error) setFeedback(result);
            return { error: result.error ?? null };
          }}
        />
      ) : null}
      <FormMessage
        error={clientError ?? feedback.error ?? null}
        success={clientError ? null : (feedback.success ?? null)}
        className="text-xs"
      />
    </div>
  );
}
