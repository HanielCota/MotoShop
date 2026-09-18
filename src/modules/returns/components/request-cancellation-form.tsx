"use client";

import { useState, useTransition } from "react";

import { requestCancellationAction } from "@/modules/returns/actions/cancellation-actions";

export function RequestCancellationForm({
  orderNumber,
  sellerOrderId,
  accessToken,
}: {
  orderNumber: string;
  sellerOrderId: string;
  accessToken?: string;
}) {
  const [message, setMessage] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function submit() {
    const customerMessage = window.prompt("Explique o motivo do cancelamento (opcional):") ?? undefined;
    startTransition(async () => {
      const result = await requestCancellationAction({
        orderNumber,
        sellerOrderId,
        reason: "CUSTOMER_REQUEST",
        customerMessage,
        idempotencyKey: crypto.randomUUID(),
        ...(accessToken ? { accessToken } : {}),
      });
      setMessage(result.error ?? result.success);
    });
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Enviando solicitação..." : "Solicitar cancelamento"}
      </button>
      {message ? <p className="mt-2 text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
