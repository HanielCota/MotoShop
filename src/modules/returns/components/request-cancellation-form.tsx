"use client";
import { Textarea } from "@/components/ui/textarea";

import { useState, useTransition } from "react";
import { Dialog } from "@base-ui/react/dialog";

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
        setMessage(result.error ?? result.success);
        if (!result.error) setOpen(false);
      } catch {
        setMessage("Não foi possível solicitar o cancelamento. Tente novamente.");
      }
    });
  }

  return (
    <div className="mt-3">
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger
          className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:ring-3 focus-visible:ring-red-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
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
                className="border-input bg-background focus-visible:ring-ring/40 w-full resize-y rounded-md border p-3 text-sm focus-visible:ring-3 focus-visible:outline-none"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Dialog.Close
                disabled={isPending}
                className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Voltar
              </Dialog.Close>
              <button
                type="button"
                onClick={submit}
                disabled={isPending}
                className="bg-destructive rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {isPending ? "Enviando..." : "Enviar solicitação"}
              </button>
            </div>
            {message ? (
              <p className="text-sm" role="status">
                {message}
              </p>
            ) : null}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      {message && !open ? (
        <p className="mt-2 text-sm text-slate-600" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
