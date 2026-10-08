"use client";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Textarea } from "@/components/ui/textarea";

import { useState, useTransition } from "react";
import { Dialog } from "@base-ui/react/dialog";

import {
  requestCancellationAction,
  type CancellationActionState,
} from "@/modules/returns/actions/cancellation-actions";

export function RequestCancellationForm({
  orderNumber,
  sellerOrderId,
  accessToken,
}: {
  orderNumber: string;
  sellerOrderId: string;
  accessToken?: string;
}) {
  const [feedback, setFeedback] = useState<CancellationActionState>({});
  const [open, setOpen] = useState(false);
  const [customerMessage, setCustomerMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      try {
        const result = await requestCancellationAction({
          orderNumber,
          sellerOrderId,
          reason: "CUSTOMER_REQUEST",
          customerMessage: customerMessage.trim() || undefined,
          idempotencyKey: crypto.randomUUID(),
          ...(accessToken ? { accessToken } : {}),
        });
        setFeedback(result);
        if (!result.error) setOpen(false);
      } catch {
        setFeedback({ error: "Não foi possível solicitar o cancelamento. Tente novamente." });
      }
    });
  }

  return (
    <div className="space-y-2">
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger
          className={buttonVariants({ variant: "destructive", size: "sm" })}
          disabled={isPending || Boolean(feedback.success)}
        >
          Solicitar cancelamento
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/55" />
          <Dialog.Popup className="bg-background text-foreground fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-xl border p-5 shadow-xl">
            <Dialog.Title className="text-lg font-semibold">Solicitar cancelamento</Dialog.Title>
            <Dialog.Description className="text-muted-foreground text-sm">
              Nossa equipe analisará o pedido antes de confirmar o cancelamento.
            </Dialog.Description>
            <label className="block space-y-2 text-sm font-medium">
              Motivo (opcional)
              <Textarea
                value={customerMessage}
                onChange={(event) => setCustomerMessage(event.target.value)}
                maxLength={1000}
                rows={4}
                className="w-full resize-y"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Dialog.Close disabled={isPending} className={buttonVariants({ variant: "outline" })}>
                Voltar
              </Dialog.Close>
              <Button type="button" variant="destructive" onClick={submit} disabled={isPending}>
                {isPending ? "Enviando..." : "Enviar solicitação"}
              </Button>
            </div>
            <FormMessage error={feedback.error ?? null} />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      {!open ? <FormMessage error={feedback.error ?? null} success={feedback.success ?? null} /> : null}
    </div>
  );
}
