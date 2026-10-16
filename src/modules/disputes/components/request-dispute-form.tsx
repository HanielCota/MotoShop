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

const DESCRIPTION_MIN_LENGTH = 10;

/** Same rule as the server (DN-03): the description explains the case in at least 10 characters. */
export function disputeDescriptionError(description: string): string | null {
  if (description.trim().length >= DESCRIPTION_MIN_LENGTH) return null;
  return `Descreva o problema com pelo menos ${DESCRIPTION_MIN_LENGTH} caracteres.`;
}

export function RequestDisputeForm({ orderNumber, sellerOrderId }: { orderNumber: string; sellerOrderId: string }) {
  const [reason, setReason] = useState<(typeof reasons)[number][0]>(reasons[0][0]);
  const [description, setDescription] = useState("");
  const [feedback, setFeedback] = useState<DisputeActionState>({});
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const descriptionError = disputeDescriptionError(description);
    if (descriptionError) {
      setFeedback({ error: descriptionError });
      return;
    }

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
    <form onSubmit={submit} noValidate className="border-warning/40 bg-warning-surface space-y-3 rounded-lg border p-4">
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
        maxLength={2000}
        aria-invalid={feedback.error && !feedback.success ? true : undefined}
        rows={4}
        placeholder="Descreva o que aconteceu para o Moto Shop mediar o caso."
        aria-label="Descrição do problema"
        className="bg-background w-full"
      />
      <FormMessage error={feedback.error ?? null} success={feedback.success ?? null} />
      <Button pending={pending} pendingLabel="Abrindo disputa…" type="submit" disabled={Boolean(feedback.success)}>
        Enviar para mediação
      </Button>
    </form>
  );
}
