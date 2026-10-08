"use client";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";

import { useState, useTransition } from "react";

import { refundReturnRequestAction, reviewReturnRequestAction } from "../actions/admin-return-actions";

type Feedback = { error?: string; success?: string };

export function ReturnStatusActions({ returnRequestId, status }: { returnRequestId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>({});
  const canReview = status === "REQUESTED" || status === "UNDER_REVIEW";
  const canReceive = status === "APPROVED";
  const canRefund = status === "RETURNED";

  function review(decision: "APPROVE" | "RECEIVE", note?: string) {
    const formData = new FormData();
    formData.set("decision", decision);
    if (note) formData.set("note", note);
    startTransition(async () => {
      const result = await reviewReturnRequestAction(returnRequestId, formData);
      setFeedback(result);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {canReview ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" type="button" onClick={() => review("APPROVE")} disabled={pending}>
            {pending ? "Salvando..." : "Aprovar"}
          </Button>
          <form
            action={async (formData) => {
              const result = await reviewReturnRequestAction(returnRequestId, formData);
              setFeedback(result);
            }}
            className="flex min-w-0 flex-1 gap-2"
          >
            <input type="hidden" name="decision" value="REJECT" />
            <Input name="note" placeholder="Motivo da recusa" required className="min-w-0 flex-1" />
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              Recusar
            </Button>
          </form>
        </div>
      ) : null}
      {canReceive ? (
        <Button variant="outline" size="sm" type="button" onClick={() => review("RECEIVE")} disabled={pending}>
          {pending ? "Registrando..." : "Registrar recebimento"}
        </Button>
      ) : null}
      {canRefund ? (
        <Button
          size="sm"
          type="button"
          onClick={() =>
            startTransition(async () => {
              const result = await refundReturnRequestAction(returnRequestId);
              setFeedback(result);
            })
          }
          disabled={pending}
        >
          {pending ? "Reembolsando..." : "Processar reembolso"}
        </Button>
      ) : null}
      <FormMessage error={feedback.error ?? null} success={feedback.success ?? null} className="text-xs" />
    </div>
  );
}
