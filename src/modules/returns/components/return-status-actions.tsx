"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
          <Button size="compact" type="button" onClick={() => review("APPROVE")} disabled={pending}>
            {pending ? "Salvando..." : "Aprovar"}
          </Button>
          <form
            action={async (formData) => {
              const result = await reviewReturnRequestAction(returnRequestId, formData);
              setMessage(result.error ?? result.success);
            }}
            className="flex min-w-0 flex-1 gap-2"
          >
            <input type="hidden" name="decision" value="REJECT" />
            <Input name="note" placeholder="Motivo da recusa" required className="h-8 min-w-0 flex-1 px-2.5 text-xs" />
            <Button type="submit" variant="outline" size="compact" disabled={pending}>
              Recusar
            </Button>
          </form>
        </div>
      ) : null}
      {canReceive ? (
        <Button variant="outline" size="compact" type="button" onClick={() => review("RECEIVE")} disabled={pending}>
          {pending ? "Registrando..." : "Registrar recebimento"}
        </Button>
      ) : null}
      {canRefund ? (
        <Button
          size="compact"
          type="button"
          onClick={() =>
            startTransition(async () => {
              const result = await refundReturnRequestAction(returnRequestId);
              setMessage(result.error ?? result.success);
            })
          }
          disabled={pending}
        >
          {pending ? "Reembolsando..." : "Processar reembolso"}
        </Button>
      ) : null}
      {message ? (
        <p className="text-muted-foreground text-xs" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
