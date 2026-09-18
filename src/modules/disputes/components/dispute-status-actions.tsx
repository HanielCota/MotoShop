"use client";

import { useState, useTransition } from "react";

import { reviewDisputeAction } from "../actions/admin-dispute-actions";

export function DisputeStatusActions({ disputeId, status }: { disputeId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string>();

  function review(decision: "START_REVIEW" | "RESOLVE" | "REJECT") {
    const formData = new FormData();
    formData.set("decision", decision);
    if (note) formData.set("note", note);
    startTransition(async () => {
      const result = await reviewDisputeAction(disputeId, formData);
      setMessage(result.error ?? result.success);
    });
  }

  return (
    <div className="flex min-w-56 flex-col gap-2">
      {status === "OPEN" ? (
        <button
          type="button"
          onClick={() => review("START_REVIEW")}
          disabled={pending}
          className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          Assumir análise
        </button>
      ) : null}
      {status === "UNDER_REVIEW" ? (
        <>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            required
            rows={3}
            placeholder="Resolução ou motivo da decisão"
            className="rounded-md border border-slate-300 px-2 py-2 text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => review("RESOLVE")}
              disabled={pending}
              className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              Resolver
            </button>
            <button
              type="button"
              onClick={() => review("REJECT")}
              disabled={pending}
              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-60"
            >
              Rejeitar
            </button>
          </div>
        </>
      ) : null}
      {message ? (
        <p className="text-xs text-slate-600" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
