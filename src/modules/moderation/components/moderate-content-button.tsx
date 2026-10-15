"use client";
import { startTransition, useRef } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormMessage } from "@/components/ui/form-message";

import { moderateContentAction, type ModerateContentState } from "../actions/moderate-content-action";
import type { ModerationKind } from "../queries/moderation-queue";
import { useServerActionState } from "@/shared/forms/server-action-submit";

const initialState: ModerateContentState = {};

export function ModerateContentButton({ kind, id, hidden }: { kind: ModerationKind; id: string; hidden: boolean }) {
  const [state, action, pending] = useServerActionState(moderateContentAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  function submit() {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    startTransition(() => action(formData));
  }

  return (
    <form ref={formRef} action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="hide" value={String(!hidden)} />
      {hidden ? (
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Aguarde..." : "Restaurar"}
        </Button>
      ) : (
        // Ocultar tira o conteúdo do site para todos: pede confirmação (BUG-004).
        <ConfirmDialog
          trigger={
            <Button type="button" variant="outline" disabled={pending}>
              {pending ? "Aguarde..." : "Ocultar"}
            </Button>
          }
          title="Ocultar este conteúdo?"
          description="Ele some da página pública para todos. Você pode restaurar depois."
          confirmLabel="Ocultar"
          tone="destructive"
          onConfirm={submit}
        />
      )}
      <FormMessage variant="inline" error={state.error ?? null} success={state.success ?? null} />
    </form>
  );
}
