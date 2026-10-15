"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useId, useRef, useState, type ReactElement, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Textarea } from "@/components/ui/textarea";

const NETWORK_ERROR_MESSAGE = "Não foi possível conectar. Verifique sua conexão e tente novamente.";
const REQUIRED_REASON_MESSAGE = "Informe o motivo para continuar.";

export type ConfirmDialogResult = { error?: string | null | undefined } | void | undefined;

export type ConfirmDialogReason = {
  label: string;
  required?: boolean | undefined;
  placeholder?: string | undefined;
  maxLength?: number | undefined;
};

type ConfirmDialogProps = {
  /** Element that opens the dialog, usually a `<Button>`. */
  trigger: ReactElement;
  title: string;
  description: ReactNode;
  /** Optional block shown before the buttons, e.g. amounts, store and order of a refund. */
  summary?: ReactNode;
  /** Adds a reason field; its trimmed value is passed to `onConfirm`. */
  reason?: ConfirmDialogReason | undefined;
  confirmLabel: string;
  pendingLabel?: string | undefined;
  cancelLabel?: string | undefined;
  tone?: "default" | "destructive" | undefined;
  disabled?: boolean | undefined;
  /**
   * Runs the action. Returning `{ error }` keeps the dialog open with the message;
   * anything else closes it. A thrown error (e.g. network failure) is shown inline.
   */
  onConfirm: (input: { reason: string }) => Promise<ConfirmDialogResult> | ConfirmDialogResult;
};

function errorOf(result: ConfirmDialogResult): string | null {
  if (!result) return null;
  return result.error ?? null;
}

/**
 * Confirmation for destructive, financial or irreversible actions. Built on the
 * Base UI AlertDialog: focus goes to "Cancelar" (or to the reason field), ESC and
 * "Cancelar" close it, and it cannot be dismissed while the action is running.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  summary,
  reason,
  confirmLabel,
  pendingLabel = "Enviando...",
  cancelLabel = "Cancelar",
  tone = "default",
  disabled,
  onConfirm,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [reasonText, setReasonText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const reasonId = useId();
  const errorId = useId();

  function changeOpen(nextOpen: boolean) {
    if (pending) return;

    setOpen(nextOpen);
    setError(null);
    if (!nextOpen) setReasonText("");
  }

  async function confirm() {
    const trimmedReason = reasonText.trim();
    if (reason?.required && !trimmedReason) {
      setError(REQUIRED_REASON_MESSAGE);
      reasonRef.current?.focus();
      return;
    }

    setPending(true);
    setError(null);
    const failure = await runConfirm(onConfirm, trimmedReason);
    setPending(false);

    if (failure) {
      setError(failure);
      return;
    }

    setOpen(false);
    setReasonText("");
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={changeOpen}>
      <AlertDialog.Trigger render={trigger} disabled={disabled} />
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/55" />
        <AlertDialog.Popup
          initialFocus={reason ? reasonRef : cancelRef}
          aria-busy={pending}
          className="bg-background text-foreground fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-xl border p-5 shadow-xl"
        >
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-muted-foreground text-sm">{description}</AlertDialog.Description>
          {summary ? <div className="bg-muted/50 rounded-md border p-3 text-sm">{summary}</div> : null}
          {reason ? (
            <div className="space-y-2">
              <label htmlFor={reasonId} className="block text-sm font-medium">
                {reason.label}
                {reason.required ? null : <span className="text-muted-foreground font-normal"> (opcional)</span>}
              </label>
              <Textarea
                id={reasonId}
                ref={reasonRef}
                value={reasonText}
                onChange={(event) => setReasonText(event.target.value)}
                placeholder={reason.placeholder}
                maxLength={reason.maxLength ?? 1000}
                rows={3}
                required={reason.required}
                aria-invalid={error === REQUIRED_REASON_MESSAGE ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                disabled={pending}
              />
            </div>
          ) : null}
          <div id={errorId}>
            <FormMessage error={error} />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Close ref={cancelRef} disabled={pending} render={<Button type="button" variant="outline" />}>
              {cancelLabel}
            </AlertDialog.Close>
            <Button
              type="button"
              variant={tone === "destructive" ? "destructive-solid" : "default"}
              onClick={() => void confirm()}
              disabled={pending}
            >
              {pending ? pendingLabel : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

async function runConfirm(onConfirm: ConfirmDialogProps["onConfirm"], reason: string): Promise<string | null> {
  try {
    return errorOf(await onConfirm({ reason }));
  } catch {
    return NETWORK_ERROR_MESSAGE;
  }
}
