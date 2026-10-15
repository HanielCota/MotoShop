"use client";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Textarea } from "@/components/ui/textarea";

import { useState, useTransition } from "react";

import { reviewDisputeAction } from "../actions/admin-dispute-actions";
import { callServerAction } from "@/shared/forms/server-action-submit";

type Feedback = { error?: string; success?: string };

export function DisputeStatusActions({ disputeId, status }: { disputeId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<Feedback>({});

  function review(decision: "START_REVIEW" | "RESOLVE" | "REJECT") {
    const formData = new FormData();
    formData.set("decision", decision);
    if (note) formData.set("note", note);
    startTransition(async () => {
      const result = await callServerAction(() => reviewDisputeAction(disputeId, formData));
      setFeedback(result);
    });
  }

  return (
    <div className="flex min-w-56 flex-col gap-2">
      {status === "OPEN" ? (
        <Button type="button" size="sm" onClick={() => review("START_REVIEW")} disabled={pending}>
          Assumir análise
        </Button>
      ) : null}
      {status === "UNDER_REVIEW" ? (
        <>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            required
            rows={3}
            placeholder="Resolução ou motivo da decisão"
            aria-label="Resolução ou motivo da decisão"
            className="text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => review("RESOLVE")} disabled={pending}>
              Resolver
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => review("REJECT")} disabled={pending}>
              Recusar
            </Button>
          </div>
        </>
      ) : null}
      <FormMessage error={feedback.error ?? null} success={feedback.success ?? null} className="text-xs" />
    </div>
  );
}
