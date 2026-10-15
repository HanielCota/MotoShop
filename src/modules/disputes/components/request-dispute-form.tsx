"use client";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Textarea } from "@/components/ui/textarea";

import { DesignSelect } from "@/components/ui/design-select";

import { useState, useTransition } from "react";

import { requestDisputeAction, type DisputeActionState } from "../actions/dispute-actions";
import { callServerAction } from "@/shared/forms/server-action-submit";

const reasons = [
  ["ITEM_PROBLEM", "Problema com o item"],
  ["DELIVERY_PROBLEM", "Problema na entrega"],
  ["SELLER_SUPPORT", "Preciso de ajuda do lojista"],
  ["OTHER", "Outro motivo"],
] as const;

export function RequestDisputeForm({ orderNumber, sellerOrderId }: { orderNumber: string; sellerOrderId: string }) {
  const [reason, setReason] = useState<(typeof reasons)[number][0]>(reasons[0][0]);
  const [description, setDescription] = useState("");
  const [feedback, setFeedback] = useState<DisputeActionState>({});
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await callServerAction(() =>
        requestDisputeAction({
          orderNumber,
          sellerOrderId,
          reason,
          description,
          idempotencyKey: crypto.randomUUID(),
        }),
      );
      setFeedback(result);
      if (result.success) setDescription("");
    });
  }

  return (
    <form onSubmit={submit} className="border-warning/40 bg-warning-surface space-y-3 rounded-lg border p-4">
      <div className="space-y-1">
        <p className="text-foreground text-sm font-semibold">Abrir uma disputa</p>
        <p className="text-muted-foreground text-xs">
          Use quando não conseguir resolver com a loja. O Moto Shop fará a mediação.
        </p>
      </div>
      <DesignSelect
        aria-label="Motivo da disputa"
        value={reason}
        onValueChange={(value) => setReason(String(value) as (typeof reasons)[number][0])}
        className="bg-background w-full"
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
        aria-label="Descrição do problema"
        className="bg-background w-full"
      />
      <FormMessage error={feedback.error ?? null} success={feedback.success ?? null} />
      <Button type="submit" disabled={pending || Boolean(feedback.success)}>
        {pending ? "Abrindo disputa..." : "Enviar para mediação"}
      </Button>
    </form>
  );
}
