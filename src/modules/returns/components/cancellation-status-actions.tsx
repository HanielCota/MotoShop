"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

import {
  reviewCancellationRequestAction,
  type CancellationAdminActionState,
} from "../actions/admin-cancellation-actions";

export function CancellationStatusActions({
  cancellationRequestId,
  status,
}: {
  cancellationRequestId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<CancellationAdminActionState>({});

  function review(decision: "APPROVE" | "REJECT") {
    const formData = new FormData();
    formData.set("decision", decision);
    startTransition(async () => {
      setFeedback(await reviewCancellationRequestAction(cancellationRequestId, formData));
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" type="button" onClick={() => review("APPROVE")} disabled={pending}>
          {pending ? "Processando..." : status === "APPROVED" ? "Continuar processamento" : "Aprovar e reembolsar"}
        </Button>
        <Button variant="outline" size="sm" type="button" onClick={() => review("REJECT")} disabled={pending}>
          Rejeitar
        </Button>
      </div>
      <FormMessage error={feedback.error ?? null} success={feedback.success ?? null} className="text-xs" />
    </div>
  );
}
