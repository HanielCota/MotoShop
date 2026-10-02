"use client";
import { Textarea } from "@/components/ui/textarea";

import { DesignSelect } from "@/components/ui/design-select";

import { useState, useTransition } from "react";

import { requestDisputeAction } from "../actions/dispute-actions";

const reasons = [
  ["ITEM_PROBLEM", "Problema com o item"],
  ["DELIVERY_PROBLEM", "Problema na entrega"],
  ["SELLER_SUPPORT", "Preciso de ajuda do seller"],
  ["OTHER", "Outro motivo"],
] as const;

export function RequestDisputeForm({
  orderNumber,
  sellerOrderId,
  accessToken,
}: {
  orderNumber: string;
  sellerOrderId: string;
  accessToken?: string;
}) {
  const [reason, setReason] = useState<(typeof reasons)[number][0]>(reasons[0][0]);
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await requestDisputeAction({
        orderNumber,
        sellerOrderId,
        reason,
        description,
        idempotencyKey: crypto.randomUUID(),
        ...(accessToken ? { accessToken } : {}),
      });
      setMessage(result.error ?? result.success);
      if (result.success) setDescription("");
    });
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-slate-900">Abrir uma disputa</p>
      <DesignSelect
        aria-label="Motivo da disputa"
        value={reason}
        onValueChange={(value) => setReason(String(value) as (typeof reasons)[number][0])}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        {reasons.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </DesignSelect>
      <Textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        required
        minLength={10}
        maxLength={2000}
        rows={4}
        placeholder="Descreva o que aconteceu para o Moto Shop mediar o caso."
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
      />
      {message ? (
        <p className="text-sm text-slate-700" role="status">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
      >
        {pending ? "Abrindo disputa..." : "Enviar para mediação"}
      </button>
    </form>
  );
}
