"use client";

import { useState, useTransition } from "react";

import { reviewCancellationRequestAction } from "../actions/admin-cancellation-actions";

export function CancellationStatusActions({
  cancellationRequestId,
  status,
}: {
  cancellationRequestId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();

  function review(decision: "APPROVE" | "REJECT") {
    const formData = new FormData();
    formData.set("decision", decision);
    startTransition(async () => {
      const result = await reviewCancellationRequestAction(cancellationRequestId, formData);
      setMessage(result.error ?? result.success);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => review("APPROVE")}
          disabled={pending}
          className="bg-primary text-primary-foreground h-8 rounded-md px-3 text-xs font-medium disabled:opacity-50"
        >
          {pending ? "Processando..." : status === "APPROVED" ? "Continuar processamento" : "Aprovar e reembolsar"}
        </button>
        <button
          type="button"
          onClick={() => review("REJECT")}
          disabled={pending}
          className="border-border hover:bg-muted h-8 rounded-md border px-3 text-xs font-medium disabled:opacity-50"
        >
          Rejeitar
        </button>
      </div>
      {message ? (
        <p className="text-muted-foreground text-xs" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
