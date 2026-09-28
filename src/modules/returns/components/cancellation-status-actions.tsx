"use client";
import { Button } from "@/components/ui/button";

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
        <Button size="compact" type="button" onClick={() => review("APPROVE")} disabled={pending}>
          {pending ? "Processando..." : status === "APPROVED" ? "Continuar processamento" : "Aprovar e reembolsar"}
        </Button>
        <Button variant="outline" size="compact" type="button" onClick={() => review("REJECT")} disabled={pending}>
          Rejeitar
        </Button>
      </div>
      {message ? (
        <p className="text-muted-foreground text-xs" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
