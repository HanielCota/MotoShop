"use client";

import { useState, useTransition } from "react";

import { refundReturnRequestAction, reviewReturnRequestAction } from "../actions/admin-return-actions";

export function ReturnStatusActions({ returnRequestId, status }: { returnRequestId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const canReview = status === "REQUESTED" || status === "UNDER_REVIEW";
  const canReceive = status === "APPROVED";
  const canRefund = status === "RETURNED";

  function review(decision: "APPROVE" | "RECEIVE", note?: string) {
    const formData = new FormData();
    formData.set("decision", decision);
    if (note) formData.set("note", note);
    startTransition(async () => {
      const result = await reviewReturnRequestAction(returnRequestId, formData);
      setMessage(result.error ?? result.success);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {canReview ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => review("APPROVE")}
            disabled={pending}
            className="bg-primary text-primary-foreground hover:bg-primary/80 h-8 rounded-md px-3 text-xs font-medium disabled:opacity-50"
          >
            {pending ? "Salvando..." : "Aprovar"}
          </button>
          <form
            action={async (formData) => {
              const result = await reviewReturnRequestAction(returnRequestId, formData);
              setMessage(result.error ?? result.success);
            }}
            className="flex min-w-0 flex-1 gap-2"
          >
            <input type="hidden" name="decision" value="REJECT" />
            <input
              name="note"
              placeholder="Motivo da recusa"
              required
              className="border-input bg-background h-8 min-w-0 flex-1 rounded-md border px-2.5 text-xs"
            />
            <button
              disabled={pending}
              className="border-border hover:bg-muted h-8 rounded-md border px-3 text-xs font-medium disabled:opacity-50"
            >
              Recusar
            </button>
          </form>
        </div>
      ) : null}
      {canReceive ? (
        <button
          type="button"
          onClick={() => review("RECEIVE")}
          disabled={pending}
          className="border-border hover:bg-muted h-8 rounded-md border px-3 text-xs font-medium disabled:opacity-50"
        >
          {pending ? "Registrando..." : "Registrar recebimento"}
        </button>
      ) : null}
      {canRefund ? (
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              const result = await refundReturnRequestAction(returnRequestId);
              setMessage(result.error ?? result.success);
            })
          }
          disabled={pending}
          className="bg-primary text-primary-foreground hover:bg-primary/80 h-8 rounded-md px-3 text-xs font-medium disabled:opacity-50"
        >
          {pending ? "Reembolsando..." : "Processar reembolso"}
        </button>
      ) : null}
      {message ? (
        <p className="text-muted-foreground text-xs" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
